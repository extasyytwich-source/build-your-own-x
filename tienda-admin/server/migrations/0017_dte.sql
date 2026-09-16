-- Boleta/factura electrónica (SII): estructura de datos y ajustes.
-- Emitir un DTE real ante el SII exige, además de esto, un certificado
-- digital vigente del contribuyente (para firmar el envío) — algo que esta
-- sesión no tiene y no puede simular. Lo que sí se puede montar sin eso:
-- los datos tributarios del negocio, la carga de los CAF (los rangos de
-- folio que el SII ya autorizó) y un borrador del documento con esos datos
-- — todo lo necesario para que, el día que se cargue el certificado real,
-- solo falte conectar la firma y el envío.
CREATE TABLE dte_settings (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  rut TEXT,
  business_name TEXT,
  giro TEXT,
  address TEXT,
  environment TEXT NOT NULL DEFAULT 'certificacion' CHECK (environment IN ('certificacion', 'produccion')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un CAF por tipo de documento (39 = boleta electrónica, 33 = factura
-- electrónica), con el rango de folios que autoriza y cuál es el próximo
-- folio libre dentro de ese rango.
CREATE TABLE dte_cafs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  document_type INTEGER NOT NULL CHECK (document_type IN (39, 33)),
  folio_from INTEGER NOT NULL,
  folio_to INTEGER NOT NULL,
  next_folio INTEGER NOT NULL,
  authorized_at DATE,
  raw_xml TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cada documento generado a partir de una venta — mientras no haya firma
-- real, queda como "borrador": tiene folio y datos completos, pero no es
-- válido ante el SII hasta que se complete la firma y el envío.
CREATE TABLE dte_documents (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  document_type INTEGER NOT NULL CHECK (document_type IN (39, 33)),
  folio INTEGER NOT NULL,
  caf_id INTEGER NOT NULL REFERENCES dte_cafs(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'emitido')),
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, document_type, folio)
);

CREATE INDEX idx_dte_cafs_business_id ON dte_cafs(business_id);
CREATE INDEX idx_dte_documents_sale_id ON dte_documents(sale_id);
