import { Router } from 'express';
import { pool, getSetting, setSetting } from '../db.js';
import { getEffectiveApiKey } from '../ai.js';

export const settingsRouter = Router();

function maskKey(key) {
  if (!key) return null;
  return key.length <= 8 ? '••••' : `${key.slice(0, 6)}…${key.slice(-4)}`;
}

settingsRouter.get('/ai', async (req, res) => {
  const stored = await getSetting(req.businessId, 'anthropic_api_key');
  const key = stored || process.env.ANTHROPIC_API_KEY || null;
  res.json({
    configured: Boolean(key),
    maskedKey: maskKey(key),
    source: key && !stored ? 'env' : key ? 'settings' : null,
  });
});

settingsRouter.post('/ai', async (req, res) => {
  const { apiKey } = req.body ?? {};
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return res.status(400).json({ error: 'La API key no parece válida' });
  }
  await setSetting(req.businessId, 'anthropic_api_key', apiKey.trim());
  res.json({ ok: true, maskedKey: maskKey(apiKey.trim()) });
});

settingsRouter.delete('/ai', async (req, res) => {
  await setSetting(req.businessId, 'anthropic_api_key', '');
  res.json({ ok: true });
});

// Respaldo/restauración por negocio, en JSON: cada negocio comparte la misma
// base Postgres con todos los demás, así que un respaldo nunca puede tocar
// (ni exponer) datos fuera de su propio business_id.
settingsRouter.get('/backup', async (req, res) => {
  const businessId = req.businessId;
  const [business, products, movements, cashEntries, monthlyAnalyses] = await Promise.all([
    pool.query('SELECT name FROM businesses WHERE id = $1', [businessId]),
    pool.query('SELECT * FROM products WHERE business_id = $1 ORDER BY id', [businessId]),
    pool.query('SELECT * FROM movements WHERE business_id = $1 ORDER BY id', [businessId]),
    pool.query('SELECT * FROM cash_entries WHERE business_id = $1 ORDER BY id', [businessId]),
    pool.query('SELECT * FROM monthly_analyses WHERE business_id = $1 ORDER BY month', [
      businessId,
    ]),
  ]);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    business: business.rows[0]?.name ?? null,
    products: products.rows,
    movements: movements.rows,
    cashEntries: cashEntries.rows,
    monthlyAnalyses: monthlyAnalyses.rows,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="mostrador-respaldo-${stamp}.json"`);
  res.json(payload);
});

settingsRouter.post('/restore', async (req, res) => {
  const backup = req.body;
  if (!backup || !Array.isArray(backup.products) || !Array.isArray(backup.movements)) {
    return res.status(400).json({ error: 'El archivo no es un respaldo válido' });
  }

  const businessId = req.businessId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // El orden respeta las llaves foráneas (movimientos/caja/análisis antes
    // que productos).
    await client.query('DELETE FROM movements WHERE business_id = $1', [businessId]);
    await client.query('DELETE FROM cash_entries WHERE business_id = $1', [businessId]);
    await client.query('DELETE FROM monthly_analyses WHERE business_id = $1', [businessId]);
    await client.query('DELETE FROM products WHERE business_id = $1', [businessId]);

    const productIdMap = new Map();
    for (const p of backup.products) {
      const { rows } = await client.query(
        `INSERT INTO products
          (business_id, name, sku, category, price, cost, stock, min_stock, unit, description, image_url, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12::timestamptz, now()), COALESCE($13::timestamptz, now()))
         RETURNING id`,
        [
          businessId,
          p.name,
          p.sku,
          p.category,
          p.price,
          p.cost,
          p.stock,
          p.min_stock,
          p.unit,
          p.description,
          p.image_url,
          p.created_at,
          p.updated_at,
        ]
      );
      productIdMap.set(p.id, rows[0].id);
    }

    for (const m of backup.movements) {
      const newProductId = productIdMap.get(m.product_id);
      if (!newProductId) continue;
      await client.query(
        `INSERT INTO movements
          (business_id, product_id, type, quantity, stock_after, unit_price, unit_cost, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9::timestamptz, now()))`,
        [
          businessId,
          newProductId,
          m.type,
          m.quantity,
          m.stock_after,
          m.unit_price,
          m.unit_cost,
          m.note,
          m.created_at,
        ]
      );
    }

    for (const c of backup.cashEntries || []) {
      await client.query(
        `INSERT INTO cash_entries (business_id, entry_date, type, amount, note, created_at)
         VALUES ($1,$2,$3,$4,$5, COALESCE($6::timestamptz, now()))`,
        [businessId, c.entry_date, c.type, c.amount, c.note, c.created_at]
      );
    }

    for (const a of backup.monthlyAnalyses || []) {
      await client.query(
        `INSERT INTO monthly_analyses (business_id, month, analysis, generated_at)
         VALUES ($1,$2,$3, COALESCE($4::timestamptz, now()))`,
        [businessId, a.month, a.analysis, a.generated_at]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'No se pudo restaurar el respaldo: ' + err.message });
  } finally {
    client.release();
  }
});
