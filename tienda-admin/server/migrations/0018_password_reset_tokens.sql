-- Recuperar contraseña por correo: un token de un solo uso, con vencimiento,
-- por cada solicitud. No se reutiliza ni se reactiva — pedir un nuevo enlace
-- genera una fila nueva; las anteriores del mismo usuario simplemente
-- quedan sin usar y vencen solas.
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
