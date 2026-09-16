import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closePool } from '../helpers/server.js';
import { signUpAndActivate } from '../helpers/client.js';

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
  const { data } = await client.request('/api/products', {
    method: 'POST',
    body: { name: 'Producto', price: 1000, cost: 500, stock: 10, minStock: 1, taxCategory: 'general', ...overrides },
  });
  return data;
}

async function findSaleMovement(client, saleId) {
  const { data } = await client.request('/api/movements');
  return data.find((m) => m.saleId === saleId);
}

test('devolver una venta repone el stock y queda registrada', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 10 });

  const sale = await client.request('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.id, quantity: 4 }], paymentMethod: 'tarjeta' },
  });
  assert.equal(sale.status, 201);

  const movement = await findSaleMovement(client, sale.data.saleId);
  assert.ok(movement, 'debe existir el movimiento de salida de la venta');

  const refund = await client.request('/api/refunds', {
    method: 'POST',
    body: { saleId: sale.data.saleId, movementId: movement.id, reason: 'cliente se arrepintió' },
  });
  assert.equal(refund.status, 201);
  assert.equal(refund.data.total, 4000);

  const list = await client.request('/api/products');
  const restocked = list.data.find((p) => p.id === product.id);
  assert.equal(restocked.stock, 10, 'el stock debe volver a como estaba antes de la venta');

  const refundsForSale = await client.request(`/api/refunds?saleId=${sale.data.saleId}`);
  assert.equal(refundsForSale.data.length, 1);
});

test('no se puede devolver dos veces la misma línea de una venta', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 10 });

  const sale = await client.request('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.id, quantity: 2 }], paymentMethod: 'tarjeta' },
  });
  const movement = await findSaleMovement(client, sale.data.saleId);

  const first = await client.request('/api/refunds', {
    method: 'POST',
    body: { saleId: sale.data.saleId, movementId: movement.id },
  });
  assert.equal(first.status, 201);

  const second = await client.request('/api/refunds', {
    method: 'POST',
    body: { saleId: sale.data.saleId, movementId: movement.id },
  });
  assert.equal(second.status, 400);
});

test('devolver una venta inexistente o de otro negocio falla', async () => {
  const { client: clientA } = await signUpAndActivate(baseUrl);
  const { client: clientB } = await signUpAndActivate(baseUrl);
  const product = await createProduct(clientA, { stock: 5 });
  const sale = await clientA.request('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'tarjeta' },
  });

  const crossTenant = await clientB.request('/api/refunds', {
    method: 'POST',
    body: { saleId: sale.data.saleId },
  });
  assert.equal(crossTenant.status, 404);
});
