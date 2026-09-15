import { Router } from 'express';
import { pool } from '../db.js';
import {
  createBusiness,
  verifyCredentials,
  updatePassword,
  issueToken,
  requireAuth,
} from '../auth.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const token = issueToken({ userId, businessId });
    res.status(201).json({ token, subscriptionStatus: 'pendiente_pago' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Falta el correo o la contraseña' });
  }

  const result = await verifyCredentials(email, password);
  if (!result) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  const token = issueToken({ userId: result.userId, businessId: result.businessId });
  res.json({ token, subscriptionStatus: result.subscriptionStatus });
});

// El JWT es stateless: no hay nada que invalidar en el servidor, el cliente
// simplemente descarta el token. Se mantiene el endpoint para no romper la
// forma en que el frontend cierra sesión.
authRouter.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Falta la contraseña actual o la nueva' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
  const email = rows[0]?.email;
  const valid = email && (await verifyCredentials(email, currentPassword));
  if (!valid) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }

  await updatePassword(req.userId, newPassword);
  res.json({ ok: true });
});
