import crypto from 'node:crypto';
import { getSetting, setSetting } from './db.js';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const sessions = new Map();

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 64).toString('hex');
}

// En el primer arranque, guarda el PIN definido en .env como hash.
// En arranques posteriores se ignora ADMIN_PIN y se respeta el PIN ya guardado
// (por si el dueño lo cambió desde el panel).
export function ensurePinConfigured(defaultPin) {
  if (getSetting('pin_hash')) return;
  const salt = crypto.randomBytes(16).toString('hex');
  setSetting('pin_salt', salt);
  setSetting('pin_hash', hashPin(defaultPin, salt));
}

export function verifyPin(pin) {
  const salt = getSetting('pin_salt');
  const hash = getSetting('pin_hash');
  if (!salt || !hash) return false;
  const candidate = hashPin(pin, salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function updatePin(newPin) {
  const salt = crypto.randomBytes(16).toString('hex');
  setSetting('pin_salt', salt);
  setSetting('pin_hash', hashPin(newPin, salt));
}

export function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function isSessionValid(token) {
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token) {
  sessions.delete(token);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !isSessionValid(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}
