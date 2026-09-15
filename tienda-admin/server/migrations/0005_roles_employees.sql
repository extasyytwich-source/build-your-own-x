-- Permite empleados (rol 'cajero') que entran con usuario+contraseña en vez
-- de correo — el dueño los registra desde Ajustes, no se autoregistran.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD CONSTRAINT users_login_identifier_check
  CHECK (email IS NOT NULL OR username IS NOT NULL);
