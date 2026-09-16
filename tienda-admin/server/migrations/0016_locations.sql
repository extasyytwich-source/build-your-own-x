-- Multi-sucursal: el stock deja de ser un solo número por producto y pasa
-- a repartirse por ubicación (product_stock). products.stock/min_stock se
-- mantienen como el AGREGADO (suma de todas las ubicaciones) — así toda
-- pantalla/reporte que hoy solo lee product.stock sigue funcionando sin
-- cambios, mientras que Caja/movimientos/compras/devoluciones ya operan
-- contra el stock de una ubicación puntual.
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A lo más una ubicación default por negocio (la que se usa cuando no se
-- especifica ninguna, y la que recibe el stock existente al migrar).
CREATE UNIQUE INDEX idx_locations_one_default_per_business
  ON locations (business_id) WHERE is_default;

CREATE TABLE product_stock (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (product_id, location_id)
);

ALTER TABLE movements ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE purchase_orders ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;

-- Cada negocio existente arranca con una única ubicación "Principal" que
-- hereda todo el stock que ya tenía cada producto, y los movimientos
-- pasados quedan asociados a ella (nunca existió otra hasta ahora).
INSERT INTO locations (business_id, name, is_default)
SELECT id, 'Principal', true FROM businesses;

INSERT INTO product_stock (product_id, location_id, stock, min_stock)
SELECT p.id, l.id, p.stock, p.min_stock
FROM products p
JOIN locations l ON l.business_id = p.business_id AND l.is_default = true;

UPDATE movements m SET location_id = l.id
FROM locations l
WHERE l.business_id = m.business_id AND l.is_default = true;

CREATE INDEX idx_product_stock_product_id ON product_stock(product_id);
CREATE INDEX idx_product_stock_location_id ON product_stock(location_id);
