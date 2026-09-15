import { Router } from 'express';
import { pool } from '../db.js';
import { currentMonthStr } from '../dates.js';
import { computeMonthlyStats } from '../reports.js';
import { generateMonthlyAnalysis } from '../ai.js';

export const reportsRouter = Router();

reportsRouter.get('/monthly', async (req, res) => {
  const month = req.query.month || currentMonthStr();
  try {
    res.json(await computeMonthlyStats(req.businessId, month));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

reportsRouter.get('/monthly/analysis', async (req, res) => {
  const month = req.query.month || currentMonthStr();
  const { rows } = await pool.query(
    'SELECT * FROM monthly_analyses WHERE business_id = $1 AND month = $2',
    [req.businessId, month]
  );
  if (!rows[0]) return res.json({ analysis: null, generatedAt: null });
  res.json({ analysis: rows[0].analysis, generatedAt: rows[0].generated_at });
});

reportsRouter.post('/monthly/analysis', async (req, res) => {
  const month = req.body?.month || currentMonthStr();
  try {
    const stats = await computeMonthlyStats(req.businessId, month);
    const analysis = await generateMonthlyAnalysis(req.businessId, stats, month);

    await pool.query(
      `INSERT INTO monthly_analyses (business_id, month, analysis, generated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (business_id, month) DO UPDATE
         SET analysis = EXCLUDED.analysis, generated_at = EXCLUDED.generated_at`,
      [req.businessId, month, analysis]
    );

    const { rows } = await pool.query(
      'SELECT * FROM monthly_analyses WHERE business_id = $1 AND month = $2',
      [req.businessId, month]
    );
    res.json({ analysis: rows[0].analysis, generatedAt: rows[0].generated_at });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});
