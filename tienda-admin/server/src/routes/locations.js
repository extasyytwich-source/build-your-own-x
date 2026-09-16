import { Router } from 'express';
import { pool } from '../db.js';
import { broadcast } from '../events.js';
import { requireOwner } from '../auth.js';

export const locationsRouter = Router();

function serializeLocation(row) {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

locationsRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM locations WHERE business_id = $1 ORDER BY is_default DESC, name ASC',
    [req.businessId]
  );
  res.json(rows.map(serializeLocation));
});

locationsRouter.post('/', requireOwner, async (req, res) => {
  const { name } = req.body ?? {};
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'El nombre de la ubicación es obligatorio' });
  }

  const { rows } = await pool.query(
    'INSERT INTO locations (business_id, name, is_default) VALUES ($1, $2, false) RETURNING *',
    [req.businessId, name.trim()]
  );
  const location = serializeLocation(rows[0]);
  broadcast('location', { action: 'created', name: location.name }, req.headers['x-client-id'], req.businessId);
  res.status(201).json(location);
});

locationsRouter.put('/:id', requireOwner, async (req, res) => {
  const { name } = req.body ?? {};
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'El nombre de la ubicación es obligatorio' });
  }

  const { rows } = await pool.query(
    'UPDATE locations SET name = $1 WHERE business_id = $2 AND id = $3 RETURNING *',
    [name.trim(), req.businessId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Ubicación no encontrada' });
  res.json(serializeLocation(rows[0]));
});

// La ubicación default no se puede borrar (es donde vive el stock de todo
// negocio con una sola sucursal); una con stock en algún producto tampoco,
// para no perder esos números silenciosamente.
locationsRouter.delete('/:id', requireOwner, async (req, res) => {
  const { rows: existingRows } = await pool.query(
    'SELECT * FROM locations WHERE business_id = $1 AND id = $2',
    [req.businessId, req.params.id]
  );
  const location = existingRows[0];
  if (!location) return res.status(404).json({ error: 'Ubicación no encontrada' });
  if (location.is_default) {
    return res.status(400).json({ error: 'No se puede eliminar la ubicación principal' });
  }

  const { rows: stockRows } = await pool.query(
    'SELECT 1 FROM product_stock WHERE location_id = $1 AND stock != 0 LIMIT 1',
    [req.params.id]
  );
  if (stockRows[0]) {
    return res
      .status(409)
      .json({ error: 'Esta ubicación todavía tiene stock — ajústalo a 0 antes de eliminarla' });
  }

  await pool.query('DELETE FROM locations WHERE business_id = $1 AND id = $2', [
    req.businessId,
    req.params.id,
  ]);
  broadcast('location', { action: 'deleted', name: location.name }, req.headers['x-client-id'], req.businessId);
  res.json({ ok: true });
});
