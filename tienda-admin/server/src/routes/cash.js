import { Router } from 'express';
import { db } from '../db.js';
import { monthRange } from '../dates.js';

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

cashRouter.get('/', (req, res) => {
  const { month } = req.query;
  let query = 'SELECT * FROM cash_entries';
  const params = [];

  if (month) {
    try {
      const { start, end } = monthRange(month);
      query += ' WHERE entry_date >= ? AND entry_date < ?';
      params.push(start, end);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  }
  query += ' ORDER BY entry_date DESC, id DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(serializeCashEntry));
});

cashRouter.post('/', (req, res) => {
  const { date, type, amount, note } = req.body ?? {};

  if (!['ingreso', 'faltante'].includes(type)) {
    return res.status(400).json({ error: 'El tipo debe ser "ingreso" o "faltante"' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
  }

  const entryDate = date || new Date().toISOString().slice(0, 10);
  const result = db
    .prepare('INSERT INTO cash_entries (entry_date, type, amount, note) VALUES (?, ?, ?, ?)')
    .run(entryDate, type, amt, note || null);

  const row = db.prepare('SELECT * FROM cash_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeCashEntry(row));
});

cashRouter.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM cash_entries WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  res.json({ ok: true });
});
