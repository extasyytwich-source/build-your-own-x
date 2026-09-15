-- Cuenta interna del dueño de Mostrador (kuroplayfh@gmail.com) para probar
-- y demostrar el panel sin pasar por el flujo de pago. Si la cuenta todavía
-- no existe cuando corre esta migración, no hace nada (queda sin efecto
-- hasta que se registre con ese correo).
UPDATE businesses SET subscription_exempt = true
WHERE id = (SELECT business_id FROM users WHERE email = 'kuroplayfh@gmail.com');
