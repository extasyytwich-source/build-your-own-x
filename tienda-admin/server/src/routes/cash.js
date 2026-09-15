import { Router } from 'express';
import { pool } from '../db.js';
import { monthRange } from '../dates.js';
import { toCsv, sendCsv } from '../csv.js';
import { broadcast } from '../events.js';

export const cashRouter = Router();

function serializeCashEntry(row) {
  return {
    id: row.id,
    date: row.entry_date,
    type: row.type,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at,
  };
}

cashRouter.get('/', async (req, res) => {
  const { month } = req.query;
  const clauses = ['business_id = $1'];
  const params = [req.businessId];

  if (month) {
    try {
      const { start, end } = monthRange(month);
      params.push(start, end);
      clauses.push(`entry_date >= $${params.length - 1}::date AND entry_date < $${params.length}::date`);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  }

  const { rows } = await pool.query(
    `SELECT * FROM cash_entries WHERE ${clauses.join(' AND ')} ORDER BY entry_date DESC, id DESC`,
    params
  );
  res.json(rows.map(serializeCashEntry));
});

cashRouter.get('/export.csv', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM cash_entries WHERE business_id = $1 ORDER BY entry_date DESC, id DESC',
    [req.businessId]
  );
  const csv = toCsv(rows, [
    { label: 'Fecha', value: (r) => r.entry_date },
    { label: 'Tipo', value: (r) => (r.type === 'ingreso' ? 'Ingreso' : 'Faltante') },
    { label: 'Monto', value: (r) => r.amount },
    { label: 'Nota', value: (r) => r.note },
  ]);
  sendCsv(res, 'caja.csv', csv);
});

cashRouter.post('/', async (req, res) => {
  const { date, type, amount, note } = req.body ?? {};

  if (!['ingreso', 'faltante'].includes(type)) {
    return res.status(400).json({ error: 'El tipo debe ser "ingreso" o "faltante"' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
  }

  const entryDate = date || new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `INSERT INTO cash_entries (business_id, entry_date, type, amount, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [req.businessId, entryDate, type, amt, note || null]
  );

  const entry = serializeCashEntry(rows[0]);
  broadcast('cash', { action: 'created', entryType: entry.type }, req.headers['x-client-id'], req.businessId);
  res.status(201).json(entry);
});

cashRouter.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM cash_entries WHERE business_id = $1 AND id = $2 RETURNING id',
    [req.businessId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado' });
  broadcast('cash', { action: 'deleted' }, req.headers['x-client-id'], req.businessId);
  res.json({ ok: true });
});
