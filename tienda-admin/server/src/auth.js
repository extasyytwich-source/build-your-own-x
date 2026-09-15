import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from './db.js';

// En producción es obligatorio traer un secreto propio: si no está seteado,
// el servidor no arranca en vez de firmar sesiones con un valor de
// desarrollo conocido (eso permitiría a cualquiera fabricar una sesión
// válida).
function resolveJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Falta configurar JWT_SECRET. En producción es obligatorio (no se puede usar el valor de desarrollo).'
    );
  }
  return 'dev-secret-cambia-esto-en-produccion';
}

const JWT_SECRET = resolveJwtSecret();
const JWT_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const SESSION_COOKIE = 'session';

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

// Una cuenta exenta (ver migraciones 0003/0004) siempre se reporta como
// "activa", sin importar el estado real del pago — igual que hace
// /api/billing/status, para que login/signup/Google no la manden a la
// pantalla de Suscríbete apenas entra.
function effectiveSubscriptionStatus(row) {
  return row.subscription_exempt ? 'activa' : row.subscription_status;
}

// Crea el negocio y su primer usuario (el dueño) en una sola transacción.
export async function createBusiness(businessName, email, password) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length) {
    const err = new Error('Ya existe una cuenta con ese correo');
    err.status = 409;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const businessResult = await client.query(
      'INSERT INTO businesses (name) VALUES ($1) RETURNING id',
      [businessName.trim()]
    );
    const businessId = businessResult.rows[0].id;

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const userResult = await client.query(
      `INSERT INTO users (business_id, email, password_hash, password_salt, role)
       VALUES ($1, $2, $3, $4, 'owner') RETURNING id`,
      [businessId, normalizedEmail, passwordHash, salt]
    );

    await client.query('COMMIT');
    return { businessId, userId: userResult.rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const e = new Error('Ya existe una cuenta con ese correo');
      e.status = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyCredentials(email, password) {
  const { rows } = await pool.query(
    `SELECT users.id AS user_id, users.password_hash, users.password_salt, users.business_id,
            businesses.subscription_status, businesses.subscription_exempt
     FROM users
     JOIN businesses ON businesses.id = users.business_id
     WHERE users.email = $1`,
    [email.toLowerCase().trim()]
  );
  const user = rows[0];
  // Sin password_hash es una cuenta creada con Google que nunca puso
  // contraseña: no hay nada que comparar, el login por contraseña falla
  // igual que si el correo no existiera (no delatamos cómo se creó la cuenta).
  if (!user || !user.password_hash) return null;

  const candidate = hashPassword(password, user.password_salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.password_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return {
    userId: user.user_id,
    businessId: user.business_id,
    subscriptionStatus: effectiveSubscriptionStatus(user),
  };
}

export async function hasPassword(userId) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return Boolean(rows[0]?.password_hash);
}

export async function updatePassword(userId, newPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  await pool.query('UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3', [
    hash,
    salt,
    userId,
  ]);
}

export function issueToken({ userId, businessId }) {
  return jwt.sign({ userId, businessId }, JWT_SECRET, { expiresIn: JWT_TTL_MS / 1000 });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// La sesión viaja en una cookie httpOnly: JavaScript de la página (propio o
// inyectado por un XSS) no puede leerla, a diferencia de guardar el token en
// localStorage.
export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: JWT_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'No autorizado' });
  req.userId = payload.userId;
  req.businessId = payload.businessId;
  next();
}

// --- Iniciar sesión con Google ---

// Verifica la firma del ID token contra las llaves públicas de Google y que
// el "audience" sea nuestro propio Client ID (si no, cualquier token de
// cualquier app de Google sería aceptado acá).
export async function verifyGoogleIdToken(credential) {
  if (!googleClient) {
    const err = new Error('Iniciar sesión con Google no está configurado en este servidor');
    err.status = 501;
    throw err;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    const err = new Error('No se pudo verificar la sesión de Google');
    err.status = 401;
    throw err;
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    const err = new Error('Tu cuenta de Google no tiene un correo verificado');
    err.status = 401;
    throw err;
  }

  return { googleId: payload.sub, email: payload.email.toLowerCase().trim() };
}

// 1) Si ya hay un usuario con ese google_id, esa es la cuenta.
// 2) Si no, pero existe un usuario con ese correo (creado con contraseña),
//    se vincula: Google ya verificó que el correo es de esa persona.
// 3) Si no existe ninguno, hace falta el nombre del negocio (Google no lo
//    sabe) — sin él, se avisa que falta completar el registro en vez de
//    crear algo a medias.
export async function findOrCreateGoogleUser({ googleId, email, businessName }) {
  const byGoogleId = await pool.query(
    `SELECT users.id AS user_id, users.business_id, businesses.subscription_status, businesses.subscription_exempt
     FROM users JOIN businesses ON businesses.id = users.business_id
     WHERE users.google_id = $1`,
    [googleId]
  );
  if (byGoogleId.rows[0]) {
    const u = byGoogleId.rows[0];
    return { userId: u.user_id, businessId: u.business_id, subscriptionStatus: effectiveSubscriptionStatus(u) };
  }

  const byEmail = await pool.query(
    `SELECT users.id AS user_id, users.business_id, businesses.subscription_status, businesses.subscription_exempt
     FROM users JOIN businesses ON businesses.id = users.business_id
     WHERE users.email = $1`,
    [email]
  );
  if (byEmail.rows[0]) {
    const u = byEmail.rows[0];
    await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, u.user_id]);
    return { userId: u.user_id, businessId: u.business_id, subscriptionStatus: effectiveSubscriptionStatus(u) };
  }

  if (!businessName || String(businessName).trim() === '') {
    return { needsBusinessName: true };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const businessResult = await client.query(
      'INSERT INTO businesses (name) VALUES ($1) RETURNING id',
      [businessName.trim()]
    );
    const businessId = businessResult.rows[0].id;
    const userResult = await client.query(
      `INSERT INTO users (business_id, email, google_id, role) VALUES ($1, $2, $3, 'owner') RETURNING id`,
      [businessId, email, googleId]
    );
    await client.query('COMMIT');
    return { userId: userResult.rows[0].id, businessId, subscriptionStatus: 'pendiente_pago' };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const e = new Error('Ya existe una cuenta con ese correo');
      e.status = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
}
