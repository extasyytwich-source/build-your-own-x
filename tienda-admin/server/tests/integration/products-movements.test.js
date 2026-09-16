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

test('crear un producto lo deja disponible con su stock inicial', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 15 });
  assert.equal(product.stock, 15);
  assert.equal(product.lowStock, false);

  const list = await client.request('/api/products');
  assert.equal(list.status, 200);
  assert.ok(list.data.some((p) => p.id === product.id));
});

test('un movimiento de entrada aumenta el stock y uno de salida lo reduce', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 10 });

  const entrada = await client.request('/api/movements', {
    method: 'POST',
    body: { productId: product.id, type: 'entrada', quantity: 5, note: 'reposición' },
  });
  assert.equal(entrada.status, 201);
  assert.equal(entrada.data.stockAfter, 15);

  const salida = await client.request('/api/movements', {
    method: 'POST',
    body: { productId: product.id, type: 'salida', quantity: 8 },
  });
  assert.equal(salida.status, 201);
  assert.equal(salida.data.stockAfter, 7);
});

test('una salida no puede dejar el stock negativo', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 3 });

  const { status, data } = await client.request('/api/movements', {
    method: 'POST',
    body: { productId: product.id, type: 'salida', quantity: 100 },
  });
  assert.equal(status, 400);
  assert.match(data.error, /stock/i);

  const list = await client.request('/api/products');
  const stillThree = list.data.find((p) => p.id === product.id);
  assert.equal(stillThree.stock, 3, 'el stock no debe cambiar si el movimiento se rechazó');
});

test('un producto queda "bajo" cuando su stock llega al mínimo configurado', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const product = await createProduct(client, { stock: 5, minStock: 5 });
  assert.equal(product.lowStock, true);
});

test('un negocio no puede ver ni modificar los productos de otro', async () => {
  const { client: clientA } = await signUpAndActivate(baseUrl);
  const { client: clientB } = await signUpAndActivate(baseUrl);

  const productA = await createProduct(clientA);

  const listB = await clientB.request('/api/products');
  assert.ok(!listB.data.some((p) => p.id === productA.id), 'el negocio B no debe ver productos del A');

  const movementFromB = await clientB.request('/api/movements', {
    method: 'POST',
    body: { productId: productA.id, type: 'salida', quantity: 1 },
  });
  assert.equal(movementFromB.status, 404, 'no debe poder mover stock de un producto ajeno');
});
