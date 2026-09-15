import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { getEffectiveApiKey } from '../ai.js';

export const settingsRouter = Router();

function maskKey(key) {
  if (!key) return null;
  return key.length <= 8 ? '••••' : `${key.slice(0, 6)}…${key.slice(-4)}`;
}

settingsRouter.get('/ai', (req, res) => {
  const key = getEffectiveApiKey();
  res.json({
    configured: Boolean(key),
    maskedKey: maskKey(key),
    source: key && !getSetting('anthropic_api_key') ? 'env' : key ? 'settings' : null,
  });
});

settingsRouter.post('/ai', (req, res) => {
  const { apiKey } = req.body ?? {};
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return res.status(400).json({ error: 'La API key no parece válida' });
  }
  setSetting('anthropic_api_key', apiKey.trim());
  res.json({ ok: true, maskedKey: maskKey(apiKey.trim()) });
});

settingsRouter.delete('/ai', (req, res) => {
  setSetting('anthropic_api_key', '');
  res.json({ ok: true });
});
