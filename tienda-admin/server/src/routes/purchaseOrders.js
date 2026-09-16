import { Router } from 'express';
import { pool } from '../db.js';
import { broadcast } from '../events.js';
import { registerMovement } from './movements.js';

export const purchaseOrdersRouter = Router();

const ORDERS_QUERY = `
  SELECT purchase_orders.*, suppliers.name AS supplier_name
  FROM purchase_orders
  JOIN suppliers ON suppliers.id = purchase_orders.supplier_id
`;

function serializeOrder(row, items = null) {
  const order = {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    receivedAt: row.received_at,
  };
  if (items) {
    order.items = items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      unitCost: i.unit_cost,
    }));
    order.total = order.items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitCost), 0);
  }
  return order;
}

async function fetchItems(purchaseOrderId) {
  const { rows } = await pool.query(
    `SELECT purchase_order_items.*, products.name AS product_name
     FROM purchase_order_items JOIN products ON products.id = purchase_order_items.product_id
     WHERE purchase_order_id = $1 ORDER BY purchase_order_items.id ASC`,
    [purchaseOrderId]
  );
  return rows;
}

purchaseOrdersRouter.get('/', async (req, res) => {
  const { status } = req.query;
  const clauses = ['purchase_orders.business_id = $1'];
  const params = [req.businessId];
  if (status) {
    params.push(status);
    clauses.push(`purchase_orders.status = $${params.length}`);
  }
  const { rows } = await pool.query(
    `${ORDERS_QUERY} WHERE ${clauses.join(' AND ')} ORDER BY purchase_orders.created_at DESC`,
    params
  );
  const orders = await Promise.all(
    rows.map(async (row) => serializeOrder(row, await fetchItems(row.id)))
  );
  res.json(orders);
});

purchaseOrdersRouter.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`${ORDERS_QUERY} WHERE purchase_orders.business_id = $1 AND purchase_orders.id = $2`, [
    req.businessId,
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  res.json(serializeOrder(rows[0], await fetchItems(rows[0].id)));
});

// Crea la orden en estado "pendiente": todavía no toca stock. Recién al
// recibirla (POST /:id/receive) se generan los movimientos de entrada.
purchaseOrdersRouter.post('/', async (req, res) => {
  const { supplierId, notes, items } = req.body ?? {};
  if (!supplierId) return res.status(400).json({ error: 'Selecciona un proveedor' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Agrega al menos un producto a la orden' });
  }
  for (const item of items) {
    const qty = Number(item?.quantity);
    if (!item?.productId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Cada línea necesita un producto y una cantidad válida' });
    }
  }

  const { rows: supplierRows } = await pool.query(
    'SELECT id FROM suppliers WHERE business_id = $1 AND id = $2',
    [req.businessId, supplierId]
  );
  if (!supplierRows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query(
      `INSERT INTO purchase_orders (business_id, supplier_id, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.businessId, supplierId, notes || null, req.userId]
    );
    const orderId = orderRows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.productId, Number(item.quantity), Number(item.unitCost) || 0]
      );
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`${ORDERS_QUERY} WHERE purchase_orders.id = $1`, [orderId]);
    const order = serializeOrder(rows[0], await fetchItems(orderId));
    broadcast(
      'purchase_order',
      { action: 'created', supplierName: order.supplierName },
      req.headers['x-client-id'],
      req.businessId
    );
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Alguno de los productos ya no existe' });
    }
    throw err;
  } finally {
    client.release();
  }
});

// Recibir la mercadería: por cada línea se actualiza el costo del producto
// al valor pagado y se registra una entrada de stock (el mismo movimiento
// de siempre), etiquetada con esta orden. Solo se puede recibir una vez.
purchaseOrdersRouter.post('/:id/receive', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query(
      'SELECT * FROM purchase_orders WHERE business_id = $1 AND id = $2 FOR UPDATE',
      [req.businessId, req.params.id]
    );
    const order = orderRows[0];
    if (!order) {
      const err = new Error('Orden de compra no encontrada');
      err.status = 404;
      throw err;
    }
    if (order.status !== 'pendiente') {
      const err = new Error('Esta orden ya fue recibida o está cancelada');
      err.status = 400;
      throw err;
    }

    const items = await fetchItems(order.id);
    for (const item of items) {
      await client.query('UPDATE products SET cost = $1, updated_at = now() WHERE id = $2', [
        item.unit_cost,
        item.product_id,
      ]);
      await registerMovement(
        client,
        req.businessId,
        item.product_id,
        'entrada',
        Number(item.quantity),
        `Orden de compra #${order.id}`,
        { purchaseOrderId: order.id }
      );
    }

    await client.query(
      "UPDATE purchase_orders SET status = 'recibida', received_at = now() WHERE id = $1",
      [order.id]
    );
    await client.query('COMMIT');

    const { rows } = await pool.query(`${ORDERS_QUERY} WHERE purchase_orders.id = $1`, [order.id]);
    const updated = serializeOrder(rows[0], await fetchItems(order.id));
    broadcast(
      'purchase_order',
      { action: 'received', supplierName: updated.supplierName },
      req.headers['x-client-id'],
      req.businessId
    );
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  } finally {
    client.release();
  }
});

purchaseOrdersRouter.post('/:id/cancel', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE purchase_orders SET status = 'cancelada'
     WHERE business_id = $1 AND id = $2 AND status = 'pendiente'
     RETURNING id`,
    [req.businessId, req.params.id]
  );
  if (!rows[0]) {
    return res.status(400).json({ error: 'Solo se pueden cancelar órdenes pendientes' });
  }
  res.json({ ok: true });
});

purchaseOrdersRouter.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM purchase_orders WHERE business_id = $1 AND id = $2 AND status != 'recibida' RETURNING id`,
    [req.businessId, req.params.id]
  );
  if (!rows[0]) {
    return res.status(400).json({ error: 'No se encontró la orden, o ya fue recibida y no se puede eliminar' });
  }
  res.json({ ok: true });
});
