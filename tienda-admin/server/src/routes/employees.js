import { Router } from 'express';
import { pool } from '../db.js';
import { createEmployee } from '../auth.js';

export const employeesRouter = Router();

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/i;

employeesRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, username, created_at FROM users
     WHERE business_id = $1 AND role = 'cajero' ORDER BY created_at ASC`,
    [req.businessId]
  );
  res.json(
    rows.map((r) => ({ id: r.id, name: r.name, username: r.username, createdAt: r.created_at }))
  );
});

employeesRouter.post('/', async (req, res) => {
  const { name, username, password } = req.body ?? {};
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'El nombre del empleado es obligatorio' });
  }
  if (!username || !USERNAME_RE.test(String(username))) {
    return res.status(400).json({ error: 'El usuario debe tener 3-32 letras, números, puntos o guiones' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const employee = await createEmployee(req.businessId, { name, username, password });
    res.status(201).json({
      id: employee.id,
      name: employee.name,
      username: employee.username,
      createdAt: employee.created_at,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

employeesRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    `DELETE FROM users WHERE id = $1 AND business_id = $2 AND role = 'cajero'`,
    [req.params.id, req.businessId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Empleado no encontrado' });
  res.json({ ok: true });
});
