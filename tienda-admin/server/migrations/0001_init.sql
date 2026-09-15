-- Esquema inicial de Mostrador: un negocio (tienda) por cuenta, con todos sus
-- productos, movimientos, caja y análisis mensuales aislados por business_id.

CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'pendiente_pago'
    CHECK (subscription_status IN ('pendiente_pago', 'activa', 'atrasada', 'cancelada')),
  subscription_id TEXT,
  subscription_vence TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (business_id, key)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unidad',
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, sku)
);

CREATE TABLE movements (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
  quantity NUMERIC NOT NULL,
  stock_after NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cash_entries (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'faltante')),
  amount NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monthly_analyses (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  analysis TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, month)
);

CREATE INDEX idx_users_business ON users(business_id);
CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_movements_business ON movements(business_id);
CREATE INDEX idx_movements_product ON movements(product_id);
CREATE INDEX idx_movements_created ON movements(created_at);
CREATE INDEX idx_cash_entries_business ON cash_entries(business_id);
CREATE INDEX idx_cash_entries_date ON cash_entries(entry_date);
