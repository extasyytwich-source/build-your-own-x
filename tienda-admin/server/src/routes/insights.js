import { Router } from 'express';
import { pool } from '../db.js';
import { isoWeekKey } from '../dates.js';
import { buildWeeklyDigest } from '../insights.js';

export const insightsRouter = Router();

async function latestReport(businessId, kind) {
  const { rows } = await pool.query(
    `SELECT data, summary, created_at FROM insight_reports
     WHERE business_id = $1 AND kind = $2
     ORDER BY created_at DESC LIMIT 1`,
    [businessId, kind]
  );
  if (!rows[0]) return null;
  return { ...rows[0].data, summary: rows[0].summary, generatedAt: rows[0].created_at };
}

insightsRouter.get('/latest', async (req, res) => {
  try {
    const [daily, weekly] = await Promise.all([
      latestReport(req.businessId, 'daily'),
      latestReport(req.businessId, 'weekly'),
    ]);
    res.json({ daily, weekly });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// Deja pedir un digest nuevo sin esperar al scheduler — igual que
// "Actualizar análisis" en Reportes. Usa la misma clave de semana, así que
// reemplaza (no duplica) el reporte semanal que ya exista para esta semana.
insightsRouter.post('/weekly/generate', async (req, res) => {
  try {
    const { items, summary } = await buildWeeklyDigest(req.businessId);
    const weeklyKey = isoWeekKey();
    const { rows } = await pool.query(
      `INSERT INTO insight_reports (business_id, kind, period_key, data, summary)
       VALUES ($1, 'weekly', $2, $3, $4)
       ON CONFLICT (business_id, kind, period_key) DO UPDATE
         SET data = EXCLUDED.data, summary = EXCLUDED.summary, created_at = now()
       RETURNING data, summary, created_at`,
      [req.businessId, weeklyKey, JSON.stringify({ items }), summary]
    );
    res.json({ ...rows[0].data, summary: rows[0].summary, generatedAt: rows[0].created_at });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});
