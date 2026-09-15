-- Permite iniciar sesión con Google: cada usuario puede tener un google_id
-- (si se registró o vinculó con Google) y ya no está obligado a tener
-- contraseña (una cuenta creada por Google no tiene una hasta que decida
-- ponerse una desde Ajustes).

ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_salt DROP NOT NULL;
