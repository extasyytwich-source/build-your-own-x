-- Categoría de impuesto por producto: además del IVA general, la ley
-- chilena cobra un impuesto adicional específico sobre bebidas alcohólicas
-- (según grado) y bebidas azucaradas (DL 825, art. 42). Las tasas viven en
-- server/src/tax.js; acá solo se guarda la categoría elegida.
ALTER TABLE products ADD COLUMN tax_category TEXT NOT NULL DEFAULT 'general'
  CHECK (tax_category IN ('general', 'alcohol_mas_20', 'alcohol_hasta_20', 'bebida_azucarada', 'exento'));
