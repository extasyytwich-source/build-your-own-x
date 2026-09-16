-- Registra el descuento total efectivamente aplicado a la venta (ya
-- resuelto a un monto en pesos, sea que se haya ingresado como % o fijo)
-- para poder mostrarlo en el recibo. El descuento por línea no necesita
-- columna propia: ya queda reflejado en el unit_price congelado de cada
-- movimiento, igual que el precio normal — así los reportes de IVA/ganancia
-- (que se calculan desde movements) no necesitan ningún cambio.
ALTER TABLE sales ADD COLUMN discount_amount NUMERIC NOT NULL DEFAULT 0;
