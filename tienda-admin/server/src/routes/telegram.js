import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { isTelegramConfigured, getBotUsername } from '../telegram.js';

// Rutas del dueño: conectar/ver estado/desconectar su chat de Telegram.
export const telegramRouter = Router();

telegramRouter.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT telegram_chat_id FROM businesses WHERE id = $1', [
    req.businessId,
  ]);
  res.json({ configured: isTelegramConfigured(), connected: Boolean(rows[0]?.telegram_chat_id) });
});

// Genera un código de vinculación de un solo uso y arma el link que abre el
// chat con el bot ya con ese código como parámetro /start — Telegram se lo
// manda solo a nuestro webhook en cuanto la persona toca "Iniciar".
telegramRouter.post('/connect', async (req, res) => {
  if (!isTelegramConfigured()) {
    return res.status(501).json({ error: 'Los avisos de Telegram no están configurados en este servidor' });
  }
  try {
    const linkCode = crypto.randomBytes(12).toString('hex');
    await pool.query('UPDATE businesses SET telegram_link_code = $1 WHERE id = $2', [
      linkCode,
      req.businessId,
    ]);
    const username = await getBotUsername();
    res.json({ url: `https://t.me/${username}?start=${linkCode}` });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

telegramRouter.post('/disconnect', async (req, res) => {
  await pool.query(
    'UPDATE businesses SET telegram_chat_id = NULL, telegram_link_code = NULL WHERE id = $1',
    [req.businessId]
  );
  res.json({ ok: true });
});
