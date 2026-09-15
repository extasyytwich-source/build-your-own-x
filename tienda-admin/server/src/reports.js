import { pool } from './db.js';
import { monthRange } from './dates.js';

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

  const restocks = (
    await pool.query(
      `SELECT COALESCE(SUM(quantity * unit_cost), 0) AS "restockCost", COUNT(*) AS count
       FROM movements
       WHERE business_id = $1 AND type = 'entrada'
         AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
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

  const profit = sales.revenue - sales.cost;
  const difference = cash.registeredIncome - sales.revenue;

  return {
    month,
    revenue: sales.revenue,
    cost: sales.cost,
    profit,
    salesCount: sales.count,
    restockCost: restocks.restockCost,
    restockMovements: restocks.count,
    restockNeeded,
    criticalItems,
    cash: {
      registeredIncome: cash.registeredIncome,
      missingAmount: cash.missingAmount,
      expectedRevenue: sales.revenue,
      difference,
    },
  };
}
