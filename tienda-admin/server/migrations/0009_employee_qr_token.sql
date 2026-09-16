-- Código QR de acceso rápido por empleado: el dueño lo genera desde Ajustes,
-- y el empleado lo escanea con la cámara del dispositivo de la caja para
-- entrar sin escribir usuario/contraseña. Se guarda solo el hash (igual que
-- una contraseña) — la base nunca tiene el código en texto plano, y
-- regenerarlo invalida al instante el anterior.
ALTER TABLE users ADD COLUMN qr_token_hash TEXT;
CREATE UNIQUE INDEX users_qr_token_hash_idx ON users (qr_token_hash) WHERE qr_token_hash IS NOT NULL;
