import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambia-esto-en-produccion';
const JWT_TTL = '12h';

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
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
            businesses.subscription_status
     FROM users
     JOIN businesses ON businesses.id = users.business_id
     WHERE users.email = $1`,
    [email.toLowerCase().trim()]
  );
  const user = rows[0];
  if (!user) return null;

  const candidate = hashPassword(password, user.password_salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.password_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return {
    userId: user.user_id,
    businessId: user.business_id,
    subscriptionStatus: user.subscription_status,
  };
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
  return jwt.sign({ userId, businessId }, JWT_SECRET, { expiresIn: JWT_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'No autorizado' });
  req.userId = payload.userId;
  req.businessId = payload.businessId;
  next();
}
