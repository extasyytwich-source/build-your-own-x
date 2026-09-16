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
    body: { name: 'Producto', price: 1000, cost: 500, stock: 20, minStock: 1, taxCategory: 'general', ...overrides },
  });
  return data;
}

test('una venta simple descuenta el stock y arma el vuelto correctamente', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { price: 1500, stock: 10 });

  const { status, data } = await client.request('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.id, quantity: 3 }], paymentMethod: 'efectivo', amountReceived: 5000 },
  });
  assert.equal(status, 201);
  assert.equal(data.total, 4500);
  assert.equal(data.change, 500);
  assert.equal(data.discount, 0);

  const list = await client.request('/api/products');
  const updated = list.data.find((p) => p.id === product.id);
  assert.equal(updated.stock, 7);
});

test('efectivo insuficiente rechaza la venta', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { price: 1000 });

  const { status, data } = await client.request('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.id, quantity: 2 }], paymentMethod: 'efectivo', amountReceived: 100 },
  });
  assert.equal(status, 400);
  assert.match(data.error, /menor al total/);
});

test('descuento de línea (%) reduce el precio neto de esa línea', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { price: 1000, stock: 10 });

  const { data } = await client.request('/api/sales', {
    method: 'POST',
    body: {
      items: [{ productId: product.id, quantity: 3, discount: { type: 'percent', value: 20 } }],
      paymentMethod: 'tarjeta',
    },
  });
  // 1000*3=3000, -20% = 600 de descuento -> 2400 netos / 3 = 800 c/u
  assert.equal(data.items[0].unitPrice, 800);
  assert.equal(data.total, 2400);
  assert.equal(data.discount, 0, 'el descuento reportado es solo el del total, no el de línea');
});

test('descuento del total se reparte proporcionalmente entre las líneas', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const productA = await createProduct(client, { name: 'A', price: 1000, stock: 10 });
  const productB = await createProduct(client, { name: 'B', price: 2000, stock: 10 });

  const { data } = await client.request('/api/sales', {
    method: 'POST',
    body: {
      items: [
        { productId: productA.id, quantity: 1 },
        { productId: productB.id, quantity: 1 },
      ],
      paymentMethod: 'tarjeta',
      discount: { type: 'percent', value: 10 },
    },
  });
  assert.equal(data.discount, 300);
  assert.equal(data.items[0].unitPrice, 900);
  assert.equal(data.items[1].unitPrice, 1800);
  assert.equal(data.total, 2700);
});

test('si falta stock de cualquier línea, no se descuenta nada de ninguna (todo o nada)', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const plenty = await createProduct(client, { name: 'Con stock', stock: 50 });
  const scarce = await createProduct(client, { name: 'Sin stock', stock: 1 });

  const { status } = await client.request('/api/sales', {
    method: 'POST',
    body: {
      items: [
        { productId: plenty.id, quantity: 5 },
        { productId: scarce.id, quantity: 999 },
      ],
      paymentMethod: 'tarjeta',
    },
  });
  assert.equal(status, 400);

  const list = await client.request('/api/products');
  const untouched = list.data.find((p) => p.id === plenty.id);
  assert.equal(untouched.stock, 50, 'la línea con stock suficiente no debió tocarse');
});

test('el carrito vacío se rechaza', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const { status } = await client.request('/api/sales', {
    method: 'POST',
    body: { items: [], paymentMethod: 'tarjeta' },
  });
  assert.equal(status, 400);
});
