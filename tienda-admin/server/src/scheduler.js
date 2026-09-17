import { pool } from './db.js';
import { sendTelegramMessage } from './telegram.js';
import { buildDailyAlert, buildWeeklyDigest } from './insights.js';
import { todayDateKey, isoWeekKey } from './dates.js';

const TICK_MS = 15 * 60 * 1000;

async function alreadyGenerated(businessId, kind, periodKey) {
  const { rows } = await pool.query(
    'SELECT 1 FROM insight_reports WHERE business_id = $1 AND kind = $2 AND period_key = $3',
    [businessId, kind, periodKey]
  );
  return rows.length > 0;
}

async function storeReport(businessId, kind, periodKey, data, summary = null) {
  await pool.query(
    `INSERT INTO insight_reports (business_id, kind, period_key, data, summary)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (business_id, kind, period_key) DO NOTHING`,
    [businessId, kind, periodKey, JSON.stringify(data), summary]
  );
}

function formatDailyMessage(items) {
  const lines = items
    .map((i) => `• ${i.name}: ${i.stock} ${i.unit} (${i.daysOfSupply != null ? `~${i.daysOfSupply} días` : 'agotado'})`)
    .join('\n');
  return `⚠️ Se agota pronto\n\n${lines}`;
}

function formatWeeklyMessage(items, summary) {
  if (summary) return `📦 Recomendación de compra de la semana\n\n${summary}`;
  const lines = items
    .map((i) => `• ${i.name}: pedir ${i.suggestedQty} ${i.unit} para el ${i.suggestedOrderBy}`)
    .join('\n');
  return `📦 Recomendación de compra de la semana\n\n${lines}`;
}

async function processBusiness(business) {
  const businessId = business.id;
  const chatId = business.telegram_chat_id;

  const dailyKey = todayDateKey();
  if (!(await alreadyGenerated(businessId, 'daily', dailyKey))) {
    const { items } = await buildDailyAlert(businessId);
    await storeReport(businessId, 'daily', dailyKey, { items });
    if (items.length > 0 && chatId) {
      await sendTelegramMessage(chatId, formatDailyMessage(items)).catch(() => {});
    }
  }

  const weeklyKey = isoWeekKey();
  if (!(await alreadyGenerated(businessId, 'weekly', weeklyKey))) {
    const { items, summary } = await buildWeeklyDigest(businessId);
    await storeReport(businessId, 'weekly', weeklyKey, { items }, summary);
    if (items.length > 0 && chatId) {
      await sendTelegramMessage(chatId, formatWeeklyMessage(items, summary)).catch(() => {});
    }
  }
}

async function tick() {
  let businesses;
  try {
    ({ rows: businesses } = await pool.query(
      `SELECT id, telegram_chat_id FROM businesses WHERE subscription_exempt = true OR subscription_status = 'activa'`
    ));
  } catch (err) {
    console.error('Error consultando negocios activos para las alertas de IA:', err.message);
    return;
  }

  for (const business of businesses) {
    try {
      await processBusiness(business);
    } catch (err) {
      console.error(`Error generando alertas de IA para el negocio ${business.id}:`, err.message);
    }
  }
}

// Un único setInterval alcanza para el proceso único de Node de este
// despliegue (Render, sin worker/cron separado). `.unref()` es necesario
// porque tests/helpers/server.js llama a este mismo startServer() real en
// cada archivo de prueba: sin eso, cada test dejaría un temporizador vivo
// y `node --test` nunca terminaría solo.
export function startInsightScheduler() {
  const interval = setInterval(tick, TICK_MS);
  interval.unref();
  return interval;
}
