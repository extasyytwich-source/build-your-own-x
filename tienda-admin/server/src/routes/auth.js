import { Router } from 'express';
import { verifyPin, updatePin, createSession, destroySession, requireAuth } from '../auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { pin } = req.body ?? {};
  if (!pin) return res.status(400).json({ error: 'Falta el PIN' });

  if (!verifyPin(pin)) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  const token = createSession();
  res.json({ token });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  destroySession(token);
  res.json({ ok: true });
});

authRouter.post('/change-pin', requireAuth, (req, res) => {
  const { currentPin, newPin } = req.body ?? {};
  if (!currentPin || !newPin) {
    return res.status(400).json({ error: 'Falta el PIN actual o el nuevo' });
  }
  if (!verifyPin(currentPin)) {
    return res.status(401).json({ error: 'El PIN actual no es correcto' });
  }
  if (String(newPin).length < 4) {
    return res.status(400).json({ error: 'El nuevo PIN debe tener al menos 4 caracteres' });
  }
  updatePin(newPin);
  res.json({ ok: true });
});
