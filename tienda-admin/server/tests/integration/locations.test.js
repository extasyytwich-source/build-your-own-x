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

test('cada negocio nuevo recibe automáticamente una ubicación "Principal"', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const { status, data } = await client.request('/api/locations');
  assert.equal(status, 200);
  assert.equal(data.length, 1);
  assert.equal(data[0].isDefault, true);
});

test('no se puede eliminar la ubicación principal, ni una con stock', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const locations = await client.request('/api/locations');
  const principal = locations.data[0];

  const deletePrincipal = await client.request(`/api/locations/${principal.id}`, { method: 'DELETE' });
  assert.equal(deletePrincipal.status, 400);

  const created = await client.request('/api/locations', { method: 'POST', body: { name: 'Sucursal 2' } });
  assert.equal(created.status, 201);

  const product = await client.request('/api/products', {
    method: 'POST',
    body: { name: 'Producto', price: 1000, cost: 500, stock: 5, minStock: 1, taxCategory: 'general' },
  });

  await client.request('/api/movements', {
    method: 'POST',
    body: { productId: product.data.id, type: 'entrada', quantity: 3, locationId: created.data.id },
  });

  const deleteWithStock = await client.request(`/api/locations/${created.data.id}`, { method: 'DELETE' });
  assert.equal(deleteWithStock.status, 409);
});

test('el stock de cada ubicación es independiente: vender en una no afecta a la otra', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const locations = await client.request('/api/locations');
  const principal = locations.data[0];
  const secondary = await client.request('/api/locations', { method: 'POST', body: { name: 'Sucursal 2' } });

  const product = await client.request('/api/products', {
    method: 'POST',
    body: { name: 'Producto multi', price: 1000, cost: 500, stock: 0, minStock: 1, taxCategory: 'general' },
  });

  await client.request('/api/movements', {
    method: 'POST',
    body: { productId: product.data.id, type: 'entrada', quantity: 10, locationId: principal.id },
  });
  await client.request('/api/movements', {
    method: 'POST',
    body: { productId: product.data.id, type: 'entrada', quantity: 4, locationId: secondary.data.id },
  });

  const breakdown = await client.request(`/api/products/${product.data.id}/stock`);
  const byLocation = Object.fromEntries(breakdown.data.map((r) => [r.locationId, r.stock]));
  assert.equal(byLocation[principal.id], 10);
  assert.equal(byLocation[secondary.data.id], 4);

  // Vender más de lo que hay en la sucursal 2 no debe tocar el stock de la principal.
  const oversell = await client.request('/api/movements', {
    method: 'POST',
    body: { productId: product.data.id, type: 'salida', quantity: 100, locationId: secondary.data.id },
  });
  assert.equal(oversell.status, 400);

  const stillBreakdown = await client.request(`/api/products/${product.data.id}/stock`);
  const stillByLocation = Object.fromEntries(stillBreakdown.data.map((r) => [r.locationId, r.stock]));
  assert.equal(stillByLocation[principal.id], 10, 'la sobreventa en otra sucursal no debe afectar esta');

  const productList = await client.request('/api/products');
  const aggregate = productList.data.find((p) => p.id === product.data.id);
  assert.equal(aggregate.stock, 14, 'el stock del producto es la suma de todas las ubicaciones');
});
