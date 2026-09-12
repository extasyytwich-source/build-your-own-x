import { Router } from 'express';
import { db } from '../db.js';

export const movementsRouter = Router();

function serializeMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    type: row.type,
    quantity: row.quantity,
    stockAfter: row.stock_after,
    note: row.note,
    createdAt: row.created_at,
  };
}

const MOVEMENTS_QUERY = `
  SELECT movements.*, products.name AS product_name
  FROM movements
  JOIN products ON products.id = movements.product_id
`;

movementsRouter.get('/', (req, res) => {
  const { productId, type, limit } = req.query;
  let query = MOVEMENTS_QUERY;
  const clauses = [];
  const params = [];

  if (productId) {
    clauses.push('movements.product_id = ?');
    params.push(productId);
  }
  if (type) {
    clauses.push('movements.type = ?');
    params.push(type);
  }
  if (clauses.length) query += ' WHERE ' + clauses.join(' AND ');
  query += ' ORDER BY movements.created_at DESC, movements.id DESC';
  if (limit) query += ` LIMIT ${Math.min(Number(limit) || 50, 500)}`;

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(serializeMovement));
});

const registerMovement = db.transaction((productId, type, quantity, note) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    const err = new Error('Producto no encontrado');
    err.status = 404;
    throw err;
  }

  let newStock;
  if (type === 'entrada') newStock = product.stock + quantity;
  else if (type === 'salida') newStock = product.stock - quantity;
  else newStock = quantity; // ajuste: fija el stock al valor indicado

  if (newStock < 0) {
    const err = new Error('No hay suficiente stock disponible para esta salida');
    err.status = 400;
    throw err;
  }

  db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(
    newStock,
    productId
  );

  const result = db
    .prepare(
      `INSERT INTO movements (product_id, type, quantity, stock_after, note, unit_price, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(productId, type, quantity, newStock, note || null, product.price, product.cost);

  return db.prepare(MOVEMENTS_QUERY + ' WHERE movements.id = ?').get(result.lastInsertRowid);
});

movementsRouter.post('/', (req, res) => {
  const { productId, type, quantity, note } = req.body ?? {};

  if (!productId || !type || quantity === undefined) {
    return res.status(400).json({ error: 'Faltan datos: producto, tipo y cantidad' });
  }
  if (!['entrada', 'salida', 'ajuste'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de movimiento inválido' });
  }
  const qty = Number(quantity);
  if (Number.isNaN(qty) || qty < 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número válido' });
  }

  try {
    const row = registerMovement(productId, type, qty, note);
    res.status(201).json(serializeMovement(row));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});
