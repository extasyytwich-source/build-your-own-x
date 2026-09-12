import { Router } from 'express';
import { db } from '../db.js';

export const statsRouter = Router();

statsRouter.get('/', (req, res) => {
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) AS totalProducts,
        COALESCE(SUM(stock * cost), 0) AS totalStockValue,
        COALESCE(SUM(stock * price), 0) AS totalStockRetailValue
       FROM products`
    )
    .get();

  const lowStock = db
    .prepare('SELECT * FROM products WHERE stock <= min_stock ORDER BY stock ASC LIMIT 10')
    .all()
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      minStock: p.min_stock,
      unit: p.unit,
    }));

  const movementsToday = db
    .prepare(
      "SELECT COUNT(*) AS count FROM movements WHERE date(created_at) = date('now')"
    )
    .get().count;

  const topUsed = db
    .prepare(
      `SELECT products.id, products.name, SUM(movements.quantity) AS totalSalida
       FROM movements
       JOIN products ON products.id = movements.product_id
       WHERE movements.type = 'salida'
       GROUP BY movements.product_id
       ORDER BY totalSalida DESC
       LIMIT 5`
    )
    .all();

  res.json({
    totalProducts: totals.totalProducts,
    totalStockValue: totals.totalStockValue,
    totalStockRetailValue: totals.totalStockRetailValue,
    lowStockCount: lowStock.length,
    lowStockProducts: lowStock,
    movementsToday,
    topUsedProducts: topUsed,
  });
});
