import { pool } from './db.js';
import { SELLABLE_CLAUSE } from './routes/products.js';
import { generateWeeklyPurchaseDigest } from './ai.js';

const TRAILING_DAYS = 30;
const DEFAULT_LEAD_TIME_DAYS = 3;
const DAILY_ALERT_DAYS = 2;
const WEEKLY_REORDER_DAYS = 14;
const TARGET_COVERAGE_DAYS = 30;

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Velocidad de venta y cobertura estimada por producto, para todo el
// negocio (sin desglosar por sucursal en esta primera versión, igual de
// simple que stats.js). `leadTimeDays` sale del historial real de órdenes
// de compra ya recibidas del producto, o un valor por defecto si nunca se
// le hizo una.
export async function computeStockSignals(businessId) {
  const { rows } = await pool.query(
    `SELECT
       products.id, products.name, products.unit, products.stock,
       COALESCE(sold.total_qty, 0) AS "soldQty",
       COALESCE(lead.avg_lead_days, $2) AS "leadTimeDays"
     FROM products
     LEFT JOIN (
       SELECT product_id, SUM(quantity) AS total_qty
       FROM movements
       WHERE business_id = $1 AND type = 'salida'
         AND created_at >= now() - ($3 * interval '1 day')
       GROUP BY product_id
     ) sold ON sold.product_id = products.id
     LEFT JOIN (
       SELECT poi.product_id,
         AVG(EXTRACT(EPOCH FROM (po.received_at - po.created_at)) / 86400) AS avg_lead_days
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
       WHERE po.business_id = $1 AND po.status = 'recibida' AND po.received_at IS NOT NULL
       GROUP BY poi.product_id
     ) lead ON lead.product_id = products.id
     WHERE products.business_id = $1 AND ${SELLABLE_CLAUSE}`,
    [businessId, DEFAULT_LEAD_TIME_DAYS, TRAILING_DAYS]
  );

  return rows.map((row) => {
    const dailyRate = row.soldQty / TRAILING_DAYS;
    // Sin ventas en el período no hay velocidad que proyectar — no es que
    // "nunca se va a agotar", es que no hay señal confiable todavía.
    const daysOfSupply = dailyRate > 0 ? row.stock / dailyRate : null;
    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      stock: row.stock,
      dailyRate,
      daysOfSupply,
      leadTimeDays: row.leadTimeDays,
    };
  });
}

// Solo lo urgente de verdad (agotado, o se acaba en un día o dos) — es un
// aviso diario, no un reporte: si no hay nada urgente, no hay nada que
// generar ese día.
export async function buildDailyAlert(businessId) {
  const signals = await computeStockSignals(businessId);
  const items = signals
    .filter((s) => s.stock <= 0 || (s.daysOfSupply != null && s.daysOfSupply <= DAILY_ALERT_DAYS))
    .map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit,
      stock: s.stock,
      daysOfSupply: s.daysOfSupply != null ? Math.round(s.daysOfSupply * 10) / 10 : null,
    }))
    .sort((a, b) => (a.stock <= 0 ? -1 : a.daysOfSupply) - (b.stock <= 0 ? -1 : b.daysOfSupply));
  return { items };
}

// Qué conviene comprar esta semana: productos con menos de dos semanas de
// cobertura, cuánto pedir para volver a ~30 días de stock, y para cuándo
// conviene tenerlo pedido según el tiempo de reposición real del producto.
export async function buildWeeklyDigest(businessId) {
  const signals = await computeStockSignals(businessId);
  const items = signals
    .filter((s) => s.daysOfSupply != null && s.daysOfSupply <= WEEKLY_REORDER_DAYS)
    .map((s) => {
      const suggestedQty = Math.max(0, Math.ceil(s.dailyRate * TARGET_COVERAGE_DAYS - s.stock));
      const orderInDays = Math.floor(s.daysOfSupply - s.leadTimeDays);
      return {
        id: s.id,
        name: s.name,
        unit: s.unit,
        stock: s.stock,
        daysOfSupply: Math.round(s.daysOfSupply * 10) / 10,
        suggestedQty,
        suggestedOrderBy: addDays(new Date(), Math.max(orderInDays, 0)).toISOString().slice(0, 10),
        orderNow: orderInDays <= 0,
      };
    })
    .sort((a, b) => a.daysOfSupply - b.daysOfSupply);

  let summary = null;
  if (items.length > 0) {
    try {
      summary = await generateWeeklyPurchaseDigest(businessId, items);
    } catch {
      // Automático o a pedido, este digest tiene que devolver los ítems
      // calculados igual aunque no haya (o falle) la API key de IA — el
      // texto es un complemento, no un requisito.
      summary = null;
    }
  }
  return { items, summary };
}
