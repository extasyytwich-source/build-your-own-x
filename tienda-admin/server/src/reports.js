import { db } from './db.js';
import { monthRange } from './dates.js';

// Reunido en una función (en vez de vivir solo en la ruta) porque tanto el
// endpoint de reporte como el de análisis de IA necesitan los mismos datos.
export function computeMonthlyStats(month) {
  const { start, end } = monthRange(month);

  const sales = db
    .prepare(
      `SELECT
        COALESCE(SUM(quantity * unit_price), 0) AS revenue,
        COALESCE(SUM(quantity * unit_cost), 0) AS cost,
        COUNT(*) AS count
       FROM movements
       WHERE type = 'salida' AND created_at >= ? AND created_at < ?`
    )
    .get(start, end);

  const restocks = db
    .prepare(
      `SELECT COALESCE(SUM(quantity * unit_cost), 0) AS restockCost, COUNT(*) AS count
       FROM movements
       WHERE type = 'entrada' AND created_at >= ? AND created_at < ?`
    )
    .get(start, end);

  const restockNeeded = db
    .prepare(
      `SELECT id, name, stock, min_stock AS minStock, unit
       FROM products
       WHERE stock <= min_stock
       ORDER BY stock ASC`
    )
    .all();

  const criticalItems = db
    .prepare(
      `SELECT id, name, stock, min_stock AS minStock, unit
       FROM products
       WHERE stock <= 0 OR stock <= (min_stock * 0.5)
       ORDER BY stock ASC`
    )
    .all();

  const cash = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) AS registeredIncome,
        COALESCE(SUM(CASE WHEN type = 'faltante' THEN amount ELSE 0 END), 0) AS missingAmount
       FROM cash_entries
       WHERE entry_date >= ? AND entry_date < ?`
    )
    .get(start, end);

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
