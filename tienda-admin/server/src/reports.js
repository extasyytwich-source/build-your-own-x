import { pool } from './db.js';
import { monthRange } from './dates.js';
import { computeTax } from './tax.js';

// Reunido en una función (en vez de vivir solo en la ruta) porque tanto el
// endpoint de reporte como el de análisis de IA necesitan los mismos datos.
export async function computeMonthlyStats(businessId, month) {
  const { start, end } = monthRange(month);

  const sales = (
    await pool.query(
      `SELECT
        COALESCE(SUM(quantity * unit_price), 0) AS revenue,
        COALESCE(SUM(quantity * unit_cost), 0) AS cost,
        COUNT(*) AS count
       FROM movements
       WHERE business_id = $1 AND type = 'salida'
         AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
      [businessId, start, end]
    )
  ).rows[0];

  // Una devolución también registra una "entrada" (repone stock), pero no
  // es una reposición de proveedor — se excluye de este gasto para no
  // mezclar ambas cosas.
  const restocks = (
    await pool.query(
      `SELECT COALESCE(SUM(quantity * unit_cost), 0) AS "restockCost", COUNT(*) AS count
       FROM movements
       WHERE business_id = $1 AND type = 'entrada' AND refund_id IS NULL
         AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
      [businessId, start, end]
    )
  ).rows[0];

  const refunds = (
    await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total, COALESCE(SUM(cost), 0) AS cost, COUNT(*) AS count
       FROM refunds
       WHERE business_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
      [businessId, start, end]
    )
  ).rows[0];

  const restockNeeded = (
    await pool.query(
      `SELECT id, name, stock, min_stock AS "minStock", unit
       FROM products WHERE business_id = $1 AND stock <= min_stock ORDER BY stock ASC`,
      [businessId]
    )
  ).rows;

  const criticalItems = (
    await pool.query(
      `SELECT id, name, stock, min_stock AS "minStock", unit
       FROM products
       WHERE business_id = $1 AND (stock <= 0 OR stock <= (min_stock * 0.5))
       ORDER BY stock ASC`,
      [businessId]
    )
  ).rows;

  // Desglose de impuestos del mes (para que el dueño sepa cuánto de lo
  // vendido es IVA/impuesto adicional, no solo el total): cada línea de
  // venta según la categoría del producto en ese momento, restando lo
  // devuelto (las "entradas" etiquetadas con refund_id) para que quede el
  // neto real vendido, no lo bruto antes de la devolución.
  const taxRows = (
    await pool.query(
      `SELECT movements.quantity, movements.unit_price, products.tax_category,
         CASE WHEN movements.type = 'salida' THEN 1 ELSE -1 END AS sign
       FROM movements JOIN products ON products.id = movements.product_id
       WHERE movements.business_id = $1
         AND (movements.type = 'salida' OR movements.refund_id IS NOT NULL)
         AND movements.created_at >= $2::timestamptz AND movements.created_at < $3::timestamptz`,
      [businessId, start, end]
    )
  ).rows;
  const taxes = taxRows.reduce(
    (acc, row) => {
      const { neto, iva, adicional } = computeTax(row.quantity * row.unit_price, row.tax_category);
      acc.neto += neto * row.sign;
      acc.iva += iva * row.sign;
      acc.impuestoAdicional += adicional * row.sign;
      return acc;
    },
    { neto: 0, iva: 0, impuestoAdicional: 0 }
  );

  const cash = (
    await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) AS "registeredIncome",
        COALESCE(SUM(CASE WHEN type = 'faltante' THEN amount ELSE 0 END), 0) AS "missingAmount"
       FROM cash_entries
       WHERE business_id = $1 AND entry_date >= $2::date AND entry_date < $3::date`,
      [businessId, start, end]
    )
  ).rows[0];

  const revenue = sales.revenue - refunds.total;
  const cost = sales.cost - refunds.cost;
  const profit = revenue - cost;
  const difference = cash.registeredIncome - revenue;

  return {
    month,
    revenue,
    cost,
    profit,
    salesCount: sales.count,
    restockCost: restocks.restockCost,
    restockMovements: restocks.count,
    restockNeeded,
    criticalItems,
    taxes,
    refunds: { total: refunds.total, count: refunds.count },
    cash: {
      registeredIncome: cash.registeredIncome,
      missingAmount: cash.missingAmount,
      expectedRevenue: revenue,
      difference,
    },
  };
}
