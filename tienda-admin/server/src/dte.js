// Boleta/factura electrónica (SII) — utilidades mínimas para leer un CAF
// (el archivo XML que el SII entrega autorizando un rango de folios) sin
// depender de ninguna librería de XML: el formato es siempre el mismo
// puñado de etiquetas planas, así que alcanza con una extracción simple.
// Lo que el CAF NO alcanza a resolver es la firma del documento (eso
// requiere el certificado digital del contribuyente) — por eso todo lo que
// se genera acá queda marcado como "borrador".
function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

export function parseCaf(xml) {
  const rut = extractTag(xml, 'RE');
  const businessName = extractTag(xml, 'RS');
  const documentTypeRaw = extractTag(xml, 'TD');
  const folioFrom = extractTag(xml, 'D');
  const folioTo = extractTag(xml, 'H');
  const authorizedAt = extractTag(xml, 'FA');

  if (!rut || !documentTypeRaw || !folioFrom || !folioTo) {
    const err = new Error('El archivo no tiene el formato de un CAF válido');
    err.status = 400;
    throw err;
  }

  const documentType = Number(documentTypeRaw);
  if (![39, 33].includes(documentType)) {
    const err = new Error('Solo se aceptan CAF de boleta (39) o factura (33) electrónica');
    err.status = 400;
    throw err;
  }

  return {
    rut,
    businessName,
    documentType,
    folioFrom: Number(folioFrom),
    folioTo: Number(folioTo),
    authorizedAt: authorizedAt || null,
  };
}

export const DOCUMENT_TYPE_LABELS = {
  39: 'Boleta electrónica',
  33: 'Factura electrónica',
};
