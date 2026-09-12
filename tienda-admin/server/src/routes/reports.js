import { Router } from 'express';
import { db } from '../db.js';
import { currentMonthStr } from '../dates.js';
import { computeMonthlyStats } from '../reports.js';
import { generateMonthlyAnalysis } from '../ai.js';

export const reportsRouter = Router();

reportsRouter.get('/monthly', (req, res) => {
  const month = req.query.month || currentMonthStr();
  try {
    res.json(computeMonthlyStats(month));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

reportsRouter.get('/monthly/analysis', (req, res) => {
  const month = req.query.month || currentMonthStr();
  const row = db.prepare('SELECT * FROM monthly_analyses WHERE month = ?').get(month);
  if (!row) return res.json({ analysis: null, generatedAt: null });
  res.json({ analysis: row.analysis, generatedAt: row.generated_at });
});

reportsRouter.post('/monthly/analysis', async (req, res) => {
  const month = req.body?.month || currentMonthStr();
  try {
    const stats = computeMonthlyStats(month);
    const analysis = await generateMonthlyAnalysis(stats, month);

    db.prepare(
      `INSERT INTO monthly_analyses (month, analysis, generated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(month) DO UPDATE SET analysis = excluded.analysis, generated_at = excluded.generated_at`
    ).run(month, analysis);

    const row = db.prepare('SELECT * FROM monthly_analyses WHERE month = ?').get(month);
    res.json({ analysis: row.analysis, generatedAt: row.generated_at });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});
