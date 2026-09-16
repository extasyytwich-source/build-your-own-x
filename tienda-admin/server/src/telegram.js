import crypto from 'node:crypto';

// Un solo bot de Telegram para toda la app: cada negocio solo vincula el
// chat al que le llegan sus propios avisos (ver routes/telegram.js). Sin
// TELEGRAM_BOT_TOKEN configurado, todo esto queda apagado sin romper nada.
const TELEGRAM_API = 'https://api.telegram.org';

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

let cachedUsername = null;

export async function getBotUsername() {
  if (!isTelegramConfigured()) return null;
  if (cachedUsername) return cachedUsername;
  const res = await fetch(`${TELEGRAM_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
  const data = await res.json();
  if (!data.ok) {
    const err = new Error('No se pudo consultar el bot de Telegram (revisa TELEGRAM_BOT_TOKEN)');
    err.status = 502;
    throw err;
  }
  cachedUsername = data.result.username;
  return cachedUsername;
}

// Nunca debe reventar el flujo que la llama (una venta no falla porque
// Telegram esté caído) — el error solo queda en el log.
export async function sendTelegramMessage(chatId, text) {
  if (!isTelegramConfigured() || !chatId) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error('Error enviando mensaje de Telegram:', err.message);
  }
}

// Telegram no firma sus pedidos de webhook, pero sí manda de vuelta este
// secreto en cada uno si se lo pedimos al registrar el webhook — sin que
// coincida, cualquiera podría mandarnos updates falsos.
const webhookSecret = crypto.randomBytes(24).toString('hex');

export function getWebhookSecret() {
  return webhookSecret;
}

export async function registerWebhook(publicUrl) {
  if (!isTelegramConfigured() || !publicUrl?.startsWith('https://')) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${publicUrl}/api/telegram/webhook`,
        secret_token: webhookSecret,
      }),
    });
  } catch (err) {
    console.error('Error registrando el webhook de Telegram:', err.message);
  }
}
