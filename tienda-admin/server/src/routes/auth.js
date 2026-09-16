import { Router } from 'express';
import { pool } from '../db.js';
import {
  createBusiness,
  verifyCredentials,
  verifyEmployeeCredentials,
  verifyPasswordForUser,
  updatePassword,
  hasPassword,
  issueToken,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
  verifyQrToken,
  lookupBusiness,
} from '../auth.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Primer paso al iniciar sesión: identificar la tienda por su nombre (o su
// código, si dos negocios sin relación eligieron el mismo nombre), antes de
// elegir "soy dueño o empleado". Público (nadie inició sesión todavía).
authRouter.get('/business-lookup', async (req, res) => {
  const { q } = req.query ?? {};
  if (!q || !String(q).trim()) {
    return res.status(400).json({ error: 'Escribe el nombre de tu negocio' });
  }

  const result = await lookupBusiness(q);
  if (result.ambiguous) {
    return res.status(409).json({
      error: 'Hay más de un negocio con ese nombre. Usa el código de tienda que te dio el dueño en su lugar.',
    });
  }
  if (!result.match) {
    return res.status(404).json({ error: 'No encontramos ningún negocio con ese nombre o código' });
  }
  res.json({ name: result.match.name, storeCode: result.match.store_code });
});

authRouter.post('/signup', async (req, res) => {
  const { businessName, email, password } = req.body ?? {};

  if (!businessName || String(businessName).trim() === '') {
    return res.status(400).json({ error: 'El nombre del negocio es obligatorio' });
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: 'Ingresa un correo válido' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const { businessId, userId } = await createBusiness(businessName, email, password);
    const token = issueToken({ userId, businessId, role: 'owner' });
    setSessionCookie(res, token);
    res.status(201).json({ subscriptionStatus: 'pendiente_pago', role: 'owner' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// Login del dueño, por su correo (único en toda la plataforma).
authRouter.post('/login', async (req, res) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Falta el correo o la contraseña' });
  }

  const result = await verifyCredentials(identifier, password);
  if (!result) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  const token = issueToken({ userId: result.userId, businessId: result.businessId, role: result.role });
  setSessionCookie(res, token);
  res.json({ subscriptionStatus: result.subscriptionStatus, role: result.role, name: result.name });
});

// Login manual de un empleado: el usuario que le puso el dueño solo es
// único dentro de su propia tienda (ver migración 0010), así que hace
// falta también el código de tienda que el dueño ve en Ajustes.
authRouter.post('/employee-login', async (req, res) => {
  const { storeCode, username, password } = req.body ?? {};
  if (!storeCode || !username || !password) {
    return res.status(400).json({ error: 'Falta el código de tienda, el usuario o la contraseña' });
  }

  const result = await verifyEmployeeCredentials(storeCode, username, password);
  if (!result) {
    return res.status(401).json({ error: 'Código de tienda, usuario o contraseña incorrectos' });
  }

  const token = issueToken({ userId: result.userId, businessId: result.businessId, role: result.role });
  setSessionCookie(res, token);
  res.json({ subscriptionStatus: result.subscriptionStatus, role: result.role, name: result.name });
});

// Login de un empleado por el código QR que le generó el dueño (ver
// routes/employees.js) — evita escribir usuario/contraseña en el
// dispositivo compartido de la caja. Va bajo el mismo authLimiter que
// /login, para frenar intentos de adivinar un token a fuerza bruta.
authRouter.post('/qr-login', async (req, res) => {
  const { token } = req.body ?? {};
  if (!token) {
    return res.status(400).json({ error: 'Falta el código' });
  }

  const result = await verifyQrToken(token);
  if (!result) {
    return res.status(401).json({ error: 'Código no válido. Pide al dueño que genere uno nuevo.' });
  }

  const jwtToken = issueToken({ userId: result.userId, businessId: result.businessId, role: result.role });
  setSessionCookie(res, jwtToken);
  res.json({ subscriptionStatus: result.subscriptionStatus, role: result.role, name: result.name });
});

// Verifica el ID token que entrega el botón de Google (Google Identity
// Services) y entra o registra según corresponda. Si es una cuenta nueva y
// todavía no sabemos el nombre del negocio, no crea nada: devuelve
// needsBusinessName para que el frontend lo pida y reenvíe el mismo
// credential junto con el nombre.
authRouter.post('/google', async (req, res) => {
  const { credential, businessName } = req.body ?? {};
  if (!credential) {
    return res.status(400).json({ error: 'Falta el credential de Google' });
  }

  try {
    const { googleId, email } = await verifyGoogleIdToken(credential);
    const result = await findOrCreateGoogleUser({ googleId, email, businessName });

    if (result.needsBusinessName) {
      return res.json({ needsBusinessName: true });
    }

    const token = issueToken({ userId: result.userId, businessId: result.businessId, role: 'owner' });
    setSessionCookie(res, token);
    res.json({ subscriptionStatus: result.subscriptionStatus, role: 'owner' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// El JWT es stateless: no hay nada que invalidar en el servidor más que
// borrar la cookie donde vive.
authRouter.post('/logout', requireAuth, (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Usado por Ajustes para saber si mostrar el campo "contraseña actual" (una
// cuenta creada con Google puede no tener ninguna todavía) y por el
// frontend para decidir qué pantalla mostrar según el rol.
authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT users.email, users.username, users.name, users.role, businesses.store_code
     FROM users JOIN businesses ON businesses.id = users.business_id
     WHERE users.id = $1`,
    [req.userId]
  );
  const user = rows[0];
  res.json({
    email: user?.email ?? null,
    username: user?.username ?? null,
    name: user?.name ?? null,
    role: user?.role ?? null,
    storeCode: user?.store_code ?? null,
    hasPassword: await hasPassword(req.userId),
  });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  // Una cuenta creada con Google puede no tener contraseña todavía: en ese
  // caso se le permite ponerse una directo, sin pedir una "actual" que
  // nunca existió.
  const alreadyHasPassword = await hasPassword(req.userId);
  if (alreadyHasPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Falta la contraseña actual' });
    }
    const valid = await verifyPasswordForUser(req.userId, currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }
  }

  await updatePassword(req.userId, newPassword);
  res.json({ ok: true });
});
