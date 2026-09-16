-- Aviso por Telegram cuando se registra una venta. Un solo bot para toda la
-- app (TELEGRAM_BOT_TOKEN, ver .env.example); cada negocio solo necesita
-- vincular el chat al que le llegan sus propios avisos.
ALTER TABLE businesses ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE businesses ADD COLUMN telegram_link_code TEXT UNIQUE;
