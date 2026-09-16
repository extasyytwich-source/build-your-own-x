import { Router } from 'express';
import { pool } from '../db.js';
import { broadcast } from '../events.js';
import { registerMovement } from './movements.js';

export const refundsRouter = Router();

function serializeRefund(row) {
  return {
    id: row.id,
    saleId: row.sale_id,
    total: row.total,
    cost: row.cost,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

// Devuelve toda una venta, o solo una de sus líneas (movementId), siempre
// que esa línea no se haya devuelto ya. Reversa el stock con el mismo
// movimiento de "entrada" de siempre (repone stock), etiquetado con esta
// devolución y con la línea original que reversa — así reports.js puede
// restar exactamente lo devuelto de la venta/ganancia/IVA del mes sin
// tener que adivinar qué se devolvió.
refundsRouter.post('/', async (req, res) => {
  const { saleId, movementId, reason } = req.body ?? {};
  if (!saleId) return res.status(400).json({ error: 'Falta la venta a devolver' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: saleRows } = await client.query(
      'SELECT * FROM sales WHERE business_id = $1 AND id = $2 FOR UPDATE',
      [req.businessId, saleId]
    );
    if (!saleRows[0]) {
      const err = new Error('Venta no encontrada');
      err.status = 404;
      throw err;
    }

    const clauses = [
      'movements.business_id = $1',
      'movements.sale_id = $2',
      "movements.type = 'salida'",
      'NOT EXISTS (SELECT 1 FROM movements r WHERE r.refunded_from_id = movements.id)',
    ];
    const params = [req.businessId, saleId];
    if (movementId) {
      params.push(movementId);
      clauses.push(`movements.id = $${params.length}`);
    }
    const { rows: targets } = await client.query(
      `SELECT * FROM movements WHERE ${clauses.join(' AND ')} FOR UPDATE`,
      params
    );
    if (targets.length === 0) {
      const err = new Error(
        movementId
          ? 'Esa línea ya fue devuelta, o no pertenece a esta venta'
          : 'No queda nada por devolver de esta venta'
      );
      err.status = 400;
      throw err;
    }

    const { rows: refundRows } = await client.query(
      `INSERT INTO refunds (business_id, sale_id, created_by, reason)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.businessId, saleId, req.userId, reason || null]
    );
    const refundId = refundRows[0].id;

    let total = 0;
    let cost = 0;
    for (const movement of targets) {
      await registerMovement(
        client,
        req.businessId,
        movement.product_id,
        'entrada',
        Number(movement.quantity),
        `Devolución de venta #${saleId}`,
        {
          unitPriceOverride: Number(movement.unit_price),
          refundId,
          refundedFromId: movement.id,
        }
      );
      total += Number(movement.unit_price) * Number(movement.quantity);
      cost += Number(movement.unit_cost) * Number(movement.quantity);
    }

    await client.query('UPDATE refunds SET total = $1, cost = $2 WHERE id = $3', [total, cost, refundId]);
    await client.query('COMMIT');

    broadcast('refund', { saleId, total }, req.headers['x-client-id'], req.businessId);
    res.status(201).json(serializeRefund({ id: refundId, sale_id: saleId, total, cost, reason }));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  } finally {
    client.release();
  }
});

refundsRouter.get('/', async (req, res) => {
  const { saleId } = req.query;
  const clauses = ['business_id = $1'];
  const params = [req.businessId];
  if (saleId) {
    params.push(saleId);
    clauses.push(`sale_id = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM refunds WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  res.json(rows.map(serializeRefund));
});
