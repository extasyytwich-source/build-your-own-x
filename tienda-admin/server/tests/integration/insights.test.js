import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closePool } from '../helpers/server.js';
import { signUpAndActivate } from '../helpers/client.js';
import { pool } from '../../src/db.js';
import { computeStockSignals, buildDailyAlert, buildWeeklyDigest } from '../../src/insights.js';

let baseUrl;
let closeServer;

test.before(async () => {
  ({ baseUrl, close: closeServer } = await startTestServer());
});

test.after(async () => {
  await closeServer();
  await closePool();
});

async function createProduct(client, overrides = {}) {
  const { status, data } = await client.request('/api/products', {
    method: 'POST',
    body: {
      name: 'Producto de prueba',
      price: 1000,
      cost: 600,
      stock: 10,
      minStock: 2,
      taxCategory: 'general',
      ...overrides,
    },
  });
  assert.equal(status, 201);
  return data;
}

async function sell(client, productId, quantity) {
  const { status } = await client.request('/api/movements', {
    method: 'POST',
    body: { productId, type: 'salida', quantity },
  });
  assert.equal(status, 201);
}

async function getBusinessId(email) {
  const { rows } = await pool.query('SELECT business_id FROM users WHERE email = $1', [email]);
  return rows[0].business_id;
}

test('un producto sin ventas no tiene señal de cobertura y no aparece en ninguna alerta', async () => {
  const { client, email } = await signUpAndActivate(baseUrl);
  await createProduct(client, { stock: 20 });
  const businessId = await getBusinessId(email);

  const signals = await computeStockSignals(businessId);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].daysOfSupply, null, 'sin ventas no hay velocidad que proyectar');

  const daily = await buildDailyAlert(businessId);
  const weekly = await buildWeeklyDigest(businessId);
  assert.equal(daily.items.length, 0);
  assert.equal(weekly.items.length, 0);
});

test('ventas recientes calculan días de cobertura y cantidad sugerida de compra', async () => {
  const { client, email } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 50 });
  await sell(client, product.id, 45); // queda stock=5; 45 unidades vendidas en los últimos 30 días
  const businessId = await getBusinessId(email);

  const signals = await computeStockSignals(businessId);
  const signal = signals.find((s) => s.id === product.id);
  assert.equal(signal.stock, 5);
  assert.ok(Math.abs(signal.dailyRate - 1.5) < 0.001, `dailyRate esperado 1.5, fue ${signal.dailyRate}`);
  assert.ok(Math.abs(signal.daysOfSupply - 5 / 1.5) < 0.001);
  assert.equal(signal.leadTimeDays, 3, 'sin historial de compras recibidas, usa el tiempo de reposición por defecto');

  const weekly = await buildWeeklyDigest(businessId);
  const item = weekly.items.find((i) => i.id === product.id);
  assert.ok(item, 'con menos de 14 días de cobertura debe aparecer en la recomendación semanal');
  assert.equal(item.suggestedQty, 40, 'ceil(1.5 * 30 días de cobertura objetivo - 5 de stock) = 40');
  assert.equal(weekly.summary, null, 'sin API key de Anthropic en las pruebas, no hay texto de IA (pero sí datos)');
});

test('un stock agotado aparece en la alerta diaria', async () => {
  const { client, email } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 10 });
  await sell(client, product.id, 10); // stock queda en 0
  const businessId = await getBusinessId(email);

  const daily = await buildDailyAlert(businessId);
  const item = daily.items.find((i) => i.id === product.id);
  assert.ok(item, 'un producto agotado debe aparecer en la alerta diaria');
  assert.equal(item.stock, 0);
});

test('un producto con mucha cobertura no aparece en ninguna alerta', async () => {
  const { client, email } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 1000 });
  await sell(client, product.id, 1); // velocidad bajísima, cobertura enorme
  const businessId = await getBusinessId(email);

  const daily = await buildDailyAlert(businessId);
  const weekly = await buildWeeklyDigest(businessId);
  assert.ok(!daily.items.some((i) => i.id === product.id));
  assert.ok(!weekly.items.some((i) => i.id === product.id));
});

test('POST /api/insights/weekly/generate y GET /api/insights/latest exponen el mismo cálculo por la API', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 50 });
  await sell(client, product.id, 45);

  const generated = await client.request('/api/insights/weekly/generate', { method: 'POST' });
  assert.equal(generated.status, 200);
  assert.ok(generated.data.items.some((i) => i.id === product.id));

  const latest = await client.request('/api/insights/latest');
  assert.equal(latest.status, 200);
  assert.ok(latest.data.weekly);
  assert.ok(latest.data.weekly.items.some((i) => i.id === product.id));
  assert.equal(latest.data.daily, null, 'todavía no se generó ninguna alerta diaria (el scheduler no corrió)');
});
