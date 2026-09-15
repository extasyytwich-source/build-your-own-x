// Impuestos de venta en Chile: IVA general 19% sobre casi todo, más un
// impuesto ADICIONAL específico solo sobre bebidas (Ley sobre Impuesto a las
// Ventas y Servicios, DL 825, art. 42): alcohólicas según su grado, y
// analcohólicas/bebidas azucaradas. Estas tasas son ley, no algo que cada
// negocio deba escribir a mano — el dueño solo elige la categoría del
// producto (ver ProductFormModal.jsx), no el número.
export const TAX_CATEGORIES = {
  general: { label: 'General (19% IVA)', iva: 0.19, adicional: 0 },
  alcohol_mas_20: { label: 'Bebida alcohólica >20° (19% + 31,5%)', iva: 0.19, adicional: 0.315 },
  alcohol_hasta_20: { label: 'Bebida alcohólica ≤20° (19% + 20,5%)', iva: 0.19, adicional: 0.205 },
  bebida_azucarada: { label: 'Bebida azucarada (19% + 18%)', iva: 0.19, adicional: 0.18 },
  exento: { label: 'Exento', iva: 0, adicional: 0 },
};

export function isAlcoholCategory(taxCategory) {
  return taxCategory === 'alcohol_mas_20' || taxCategory === 'alcohol_hasta_20';
}

// El precio del producto ya incluye los impuestos (así se muestran los
// precios en el retail chileno) — se despeja el neto hacia atrás desde el
// total, no se suma hacia adelante.
export function computeTax(totalConImpuestos, taxCategory) {
  const rates = TAX_CATEGORIES[taxCategory] || TAX_CATEGORIES.general;
  const factor = 1 + rates.iva + rates.adicional;
  const neto = factor > 0 ? totalConImpuestos / factor : totalConImpuestos;
  const iva = neto * rates.iva;
  const adicional = neto * rates.adicional;
  return { neto, iva, adicional, total: totalConImpuestos };
}
