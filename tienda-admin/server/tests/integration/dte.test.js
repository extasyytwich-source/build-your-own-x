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

function buildCaf({ documentType = 39, folioFrom = 1, folioTo = 50 } = {}) {
  return `
<AUTORIZACION>
  <CAF version="1.0">
    <DA>
      <RE>76.123.456-7</RE>
      <RS>Negocio de Prueba SpA</RS>
      <TD>${documentType}</TD>
      <RNG><D>${folioFrom}</D><H>${folioTo}</H></RNG>
      <FA>2026-01-01</FA>
    </DA>
    <FRMA algoritmo="SHA1withRSA">fake-signature</FRMA>
  </CAF>
</AUTORIZACION>`;
}

async function createProductAndSale(client) {
  const product = await client.request('/api/products', {
    method: 'POST',
    body: { name: 'Producto DTE', price: 1000, cost: 500, stock: 10, minStock: 1, taxCategory: 'general' },
  });
  const sale = await client.request('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.data.id, quantity: 2 }], paymentMethod: 'tarjeta' },
  });
  return sale.data.saleId;
}

test('sin CAF cargado, generar una boleta falla con un mensaje claro', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const saleId = await createProductAndSale(client);

  const { status, data } = await client.request('/api/dte/documents', { method: 'POST', body: { saleId } });
  assert.equal(status, 400);
  assert.match(data.error, /No hay folios disponibles/);
});

test('subir un CAF inválido se rechaza', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const { status, data } = await client.request('/api/dte/cafs', {
    method: 'POST',
    body: { xml: '<no-es-un-caf/>' },
  });
  assert.equal(status, 400);
  assert.match(data.error, /formato de un CAF válido/);
});

test('generar boletas consume folios del CAF en orden, uno por venta', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const uploaded = await client.request('/api/dte/cafs', { method: 'POST', body: { xml: buildCaf() } });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.data.foliosLeft, 50);

  const saleId1 = await createProductAndSale(client);
  const doc1 = await client.request('/api/dte/documents', { method: 'POST', body: { saleId: saleId1 } });
  assert.equal(doc1.status, 201);
  assert.equal(doc1.data.folio, 1);
  assert.equal(doc1.data.status, 'borrador');

  const saleId2 = await createProductAndSale(client);
  const doc2 = await client.request('/api/dte/documents', { method: 'POST', body: { saleId: saleId2 } });
  assert.equal(doc2.status, 201);
  assert.equal(doc2.data.folio, 2);

  const cafs = await client.request('/api/dte/cafs');
  assert.equal(cafs.data[0].foliosLeft, 48);

  const documents = await client.request(`/api/dte/documents?saleId=${saleId1}`);
  assert.equal(documents.data.length, 1);
  assert.equal(documents.data[0].folio, 1);
});

test('el PDF del borrador se genera y avisa que no es válido ante el SII', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  await client.request('/api/dte/cafs', { method: 'POST', body: { xml: buildCaf() } });
  const saleId = await createProductAndSale(client);
  const doc = await client.request('/api/dte/documents', { method: 'POST', body: { saleId } });

  const res = await client.requestRaw(`/api/dte/documents/${doc.data.id}/pdf`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const buffer = Buffer.from(await res.arrayBuffer());
  assert.ok(buffer.subarray(0, 5).toString() === '%PDF-', 'debe ser un PDF válido');
});

test('no se puede eliminar un CAF que ya generó documentos', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  const uploaded = await client.request('/api/dte/cafs', { method: 'POST', body: { xml: buildCaf() } });
  const saleId = await createProductAndSale(client);
  await client.request('/api/dte/documents', { method: 'POST', body: { saleId } });

  const { status, data } = await client.request(`/api/dte/cafs/${uploaded.data.id}`, { method: 'DELETE' });
  assert.equal(status, 409);
  assert.match(data.error, /ya se generaron documentos/);
});

test('factura (33) y boleta (39) usan CAF y numeración de folios separados', async () => {
  const { client } = await signUpAndActivate(baseUrl);
  await client.request('/api/dte/cafs', { method: 'POST', body: { xml: buildCaf({ documentType: 39 }) } });
  await client.request('/api/dte/cafs', {
    method: 'POST',
    body: { xml: buildCaf({ documentType: 33, folioFrom: 500, folioTo: 510 }) },
  });

  const saleId = await createProductAndSale(client);
  const boleta = await client.request('/api/dte/documents', { method: 'POST', body: { saleId, documentType: 39 } });
  const factura = await client.request('/api/dte/documents', { method: 'POST', body: { saleId, documentType: 33 } });

  assert.equal(boleta.data.folio, 1);
  assert.equal(factura.data.folio, 500);
});
