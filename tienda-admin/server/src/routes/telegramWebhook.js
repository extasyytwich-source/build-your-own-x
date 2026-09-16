import { Router } from 'express';
import { pool } from '../db.js';
import { getWebhookSecret, sendTelegramMessage } from '../telegram.js';

// Público: lo llama Telegram directo, no un usuario logueado — por eso el
// secret_token (ver telegram.js) en vez de la cookie de sesión.
export const telegramWebhookRouter = Router();

telegramWebhookRouter.post('/', async (req, res) => {
  if (req.headers['x-telegram-bot-api-secret-token'] !== getWebhookSecret()) {
    return res.sendStatus(401);
  }

  const message = req.body?.message;
  const match = /^\/start\s+(\S+)/.exec(message?.text || '');
  if (match) {
    const linkCode = match[1];
    const chatId = String(message.chat.id);
    const { rows } = await pool.query(
      `UPDATE businesses SET telegram_chat_id = $1, telegram_link_code = NULL
       WHERE telegram_link_code = $2 RETURNING name`,
      [chatId, linkCode]
    );
    if (rows[0]) {
      await sendTelegramMessage(
        chatId,
        `¡Listo! "${rows[0].name}" va a recibir acá un aviso cada vez que se registre una venta.`
      );
    }
  }

  // Telegram reintenta si no responde 200 rápido — se contesta siempre,
  // incluso para updates que no nos interesan (otros mensajes, etc.).
  res.sendStatus(200);
});
