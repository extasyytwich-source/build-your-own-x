-- Variantes de producto (ej. talla/color): cada variante es, en la
-- práctica, otra fila de products — así reutiliza sin cambios todo lo que
-- ya opera sobre products/movements/sales/reportes (stock, precio, costo,
-- impuesto, movimientos, ventas, reportes, CSV). El producto "padre" queda
-- como agrupador cuando tiene variantes; las variantes son las unidades
-- realmente vendibles/con stock propio.
ALTER TABLE products ADD COLUMN parent_product_id INTEGER REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN variant_name TEXT;

CREATE INDEX idx_products_parent_product_id ON products(parent_product_id);
