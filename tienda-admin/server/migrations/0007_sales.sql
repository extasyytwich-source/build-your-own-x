-- Una "venta" agrupa varios movimientos de salida (uno por producto del
-- carrito) bajo un mismo ticket, para poder cobrar varios productos de una
-- vez desde Caja y emitir un solo recibo. El stock, unit_price/unit_cost
-- congelados, etc. siguen viviendo en `movements` como hasta ahora — esta
-- tabla solo guarda los metadatos del cobro.
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'tarjeta')),
  amount_received NUMERIC,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE movements ADD COLUMN sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_business ON sales(business_id);
CREATE INDEX idx_movements_sale ON movements(sale_id);
