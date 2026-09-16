-- Reemplaza la cuenta interna de administrador: la nueva
-- (fh083502@gmail.com) queda exenta de pago para probar/demostrar el panel,
-- y la anterior (kuroplayfh@gmail.com) se elimina por completo junto con
-- todos sus datos (productos, movimientos, ventas, empleados, etc. — todas
-- las tablas con business_id tienen ON DELETE CASCADE hacia businesses).
UPDATE businesses SET subscription_exempt = true
WHERE id = (SELECT business_id FROM users WHERE email = 'fh083502@gmail.com');

DELETE FROM businesses
WHERE id = (SELECT business_id FROM users WHERE email = 'kuroplayfh@gmail.com');
