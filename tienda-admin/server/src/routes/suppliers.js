import { Router } from 'express';
import { pool } from '../db.js';
import { broadcast } from '../events.js';

export const suppliersRouter = Router();

function serializeSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

suppliersRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM suppliers WHERE business_id = $1 ORDER BY name ASC',
    [req.businessId]
  );
  res.json(rows.map(serializeSupplier));
});

suppliersRouter.post('/', async (req, res) => {
  const { name, contactName, phone, email, notes } = req.body ?? {};
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
  }

  const { rows } = await pool.query(
    `INSERT INTO suppliers (business_id, name, contact_name, phone, email, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.businessId, name.trim(), contactName || null, phone || null, email || null, notes || null]
  );

  const supplier = serializeSupplier(rows[0]);
  broadcast('supplier', { action: 'created', name: supplier.name }, req.headers['x-client-id'], req.businessId);
  res.status(201).json(supplier);
});

suppliersRouter.put('/:id', async (req, res) => {
  const { rows: existingRows } = await pool.query(
    'SELECT * FROM suppliers WHERE business_id = $1 AND id = $2',
    [req.businessId, req.params.id]
  );
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const { name, contactName, phone, email, notes } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE suppliers SET name = $1, contact_name = $2, phone = $3, email = $4, notes = $5
     WHERE business_id = $6 AND id = $7 RETURNING *`,
    [
      name?.trim() || existing.name,
      contactName ?? existing.contact_name,
      phone ?? existing.phone,
      email ?? existing.email,
      notes ?? existing.notes,
      req.businessId,
      req.params.id,
    ]
  );

  const supplier = serializeSupplier(rows[0]);
  broadcast('supplier', { action: 'updated', name: supplier.name }, req.headers['x-client-id'], req.businessId);
  res.json(supplier);
});

suppliersRouter.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM suppliers WHERE business_id = $1 AND id = $2 RETURNING name',
      [req.businessId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    broadcast('supplier', { action: 'deleted', name: rows[0].name }, req.headers['x-client-id'], req.businessId);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res
        .status(409)
        .json({ error: 'No se puede eliminar: tiene órdenes de compra asociadas' });
    }
    throw err;
  }
});
