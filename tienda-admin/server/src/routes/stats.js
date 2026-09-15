import { Router } from 'express';
import { pool } from '../db.js';

export const statsRouter = Router();

statsRouter.get('/', async (req, res) => {
  const businessId = req.businessId;

  const totals = (
    await pool.query(
      `SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(stock * cost), 0) AS total_stock_value,
        COALESCE(SUM(stock * price), 0) AS total_stock_retail_value
       FROM products WHERE business_id = $1`,
      [businessId]
    )
  ).rows[0];

  const lowStock = (
    await pool.query(
      `SELECT * FROM products WHERE business_id = $1 AND stock <= min_stock ORDER BY stock ASC LIMIT 10`,
      [businessId]
    )
  ).rows.map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stock,
    minStock: p.min_stock,
    unit: p.unit,
  }));

  const movementsToday = (
    await pool.query(
      `SELECT COUNT(*) AS count FROM movements WHERE business_id = $1 AND created_at::date = now()::date`,
      [businessId]
    )
  ).rows[0].count;

  const topUsed = (
    await pool.query(
      `SELECT products.id, products.name, SUM(movements.quantity) AS "totalSalida"
       FROM movements
       JOIN products ON products.id = movements.product_id
       WHERE movements.business_id = $1 AND movements.type = 'salida'
       GROUP BY movements.product_id, products.id, products.name
       ORDER BY "totalSalida" DESC
       LIMIT 5`,
      [businessId]
    )
  ).rows;

  res.json({
    totalProducts: totals.total_products,
    totalStockValue: totals.total_stock_value,
    totalStockRetailValue: totals.total_stock_retail_value,
    lowStockCount: lowStock.length,
    lowStockProducts: lowStock,
    movementsToday,
    topUsedProducts: topUsed,
  });
});
