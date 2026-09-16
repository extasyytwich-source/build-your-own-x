-- Una devolución reversa una o varias líneas de una venta ya cobrada: se
-- registra el mismo movimiento de "entrada" de siempre (repone el stock),
-- etiquetado con esta devolución y con la línea original que reversa —
-- así queda claro que fue una devolución (no una reposición de proveedor)
-- y no se puede devolver la misma línea dos veces.
CREATE TABLE refunds (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  total NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE movements ADD COLUMN refund_id INTEGER REFERENCES refunds(id) ON DELETE SET NULL;
ALTER TABLE movements ADD COLUMN refunded_from_id INTEGER REFERENCES movements(id) ON DELETE SET NULL;

CREATE INDEX idx_refunds_sale_id ON refunds(sale_id);
