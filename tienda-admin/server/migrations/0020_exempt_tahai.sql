-- Cuenta de prueba/demostración para felix.tahai@gmail.com (negocio "tahai"):
-- queda exenta de pago para poder entrar sin pasar por el flujo de Flow,
-- mismo mecanismo ya usado para las cuentas internas de administrador.
UPDATE businesses SET subscription_exempt = true
WHERE id = (SELECT business_id FROM users WHERE email = 'felix.tahai@gmail.com');
