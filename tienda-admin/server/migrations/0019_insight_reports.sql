-- Alertas de IA automáticas (diaria de stock urgente, semanal de compras
-- recomendadas). El UNIQUE(business_id, kind, period_key) es lo que hace la
-- idempotencia del scheduler: un INSERT ... ON CONFLICT DO NOTHING alcanza
-- para saber si ya se generó el reporte de este período, sin importar
-- reinicios del proceso.
CREATE TABLE insight_reports (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('daily', 'weekly')),
  period_key TEXT NOT NULL,
  data JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, kind, period_key)
);

CREATE INDEX idx_insight_reports_business ON insight_reports(business_id, kind, created_at DESC);
