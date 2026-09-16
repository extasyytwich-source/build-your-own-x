-- Separa el "usuario" de empleado por tienda: hasta ahora era único en TODA
-- la plataforma (dos negocios sin relación no podían tener ambos, por
-- ejemplo, un empleado "juan"). Cada negocio recibe un código corto propio
-- (store_code); el login manual de empleado pasa a pedir ese código además
-- de usuario y contraseña, así el usuario solo necesita ser único DENTRO de
-- su propia tienda. El código QR de acceso rápido no cambia — ya es único
-- de por sí, no depende del usuario escrito a mano.
ALTER TABLE businesses ADD COLUMN store_code TEXT;
UPDATE businesses
SET store_code = upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 6))
WHERE store_code IS NULL;
ALTER TABLE businesses ALTER COLUMN store_code SET NOT NULL;
ALTER TABLE businesses ADD CONSTRAINT businesses_store_code_key UNIQUE (store_code);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE users ADD CONSTRAINT users_business_username_key UNIQUE (business_id, username);
