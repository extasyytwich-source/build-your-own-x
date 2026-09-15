import { Router } from 'express';
import { pool } from '../db.js';
import {
  createBusiness,
  verifyCredentials,
  updatePassword,
  hasPassword,
  issueToken,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
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
    setSessionCookie(res, token);
    res.status(201).json({ subscriptionStatus: 'pendiente_pago' });
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
  setSessionCookie(res, token);
  res.json({ subscriptionStatus: result.subscriptionStatus });
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

    const token = issueToken({ userId: result.userId, businessId: result.businessId });
    setSessionCookie(res, token);
    res.json({ subscriptionStatus: result.subscriptionStatus });
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
// cuenta creada con Google puede no tener ninguna todavía).
authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
  res.json({ email: rows[0]?.email ?? null, hasPassword: await hasPassword(req.userId) });
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
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    const email = rows[0]?.email;
    const valid = email && (await verifyCredentials(email, currentPassword));
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }
  }

  await updatePassword(req.userId, newPassword);
  res.json({ ok: true });
});
