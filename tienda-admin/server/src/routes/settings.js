import express, { Router } from 'express';
import fs from 'node:fs';
import { db, getSetting, setSetting, dbPath, pendingRestorePath } from '../db.js';
import { getEffectiveApiKey } from '../ai.js';

export const settingsRouter = Router();

const SQLITE_MAGIC = 'SQLite format 3\0';

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

settingsRouter.get('/backup', (req, res) => {
  // Vuelca el WAL a la base principal antes de copiarla, para que el
  // respaldo incluya también los cambios más recientes.
  db.pragma('wal_checkpoint(TRUNCATE)');
  const stamp = new Date().toISOString().slice(0, 10);
  res.download(dbPath, `tienda-respaldo-${stamp}.db`);
});

settingsRouter.post(
  '/restore',
  express.raw({ type: 'application/octet-stream', limit: '80mb' }),
  (req, res) => {
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }
    const header = buffer.subarray(0, SQLITE_MAGIC.length).toString('latin1');
    if (header !== SQLITE_MAGIC) {
      return res.status(400).json({ error: 'El archivo no es un respaldo válido (.db)' });
    }

    // No se puede reemplazar el archivo mientras esta misma conexión lo tiene
    // abierto: se deja pendiente y se aplica en el próximo arranque (ver db.js).
    fs.writeFileSync(pendingRestorePath, buffer);

    res.json({ ok: true, canAutoRestart: typeof global.__tiendaAdminRelaunch === 'function' });
  }
);

settingsRouter.post('/restart-app', (req, res) => {
  if (typeof global.__tiendaAdminRelaunch !== 'function') {
    return res
      .status(501)
      .json({ error: 'Este modo no puede reiniciarse solo; cierra y vuelve a abrir el programa' });
  }
  res.json({ ok: true });
  setTimeout(() => global.__tiendaAdminRelaunch(), 150);
});
