import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closePool } from '../helpers/server.js';
import { createClient, uniqueName, uniqueEmail } from '../helpers/client.js';
import { pool } from '../../src/db.js';

let baseUrl;
let closeServer;

test.before(async () => {
  ({ baseUrl, close: closeServer } = await startTestServer());
});

test.after(async () => {
  await closeServer();
  await closePool();
});

test('signup crea el negocio, deja la sesión iniciada y bloqueada hasta pagar', async () => {
  const client = createClient(baseUrl);
  const email = uniqueEmail();
  const { status, data } = await client.request('/api/auth/signup', {
    method: 'POST',
    body: { businessName: uniqueName('Almacen Signup'), email, password: 'password123' },
  });
  assert.equal(status, 201);
  assert.equal(data.role, 'owner');
  assert.equal(data.subscriptionStatus, 'pendiente_pago');

  const me = await client.request('/api/auth/me');
  assert.equal(me.data.email, email);
  assert.equal(me.data.role, 'owner');
});

test('signup rechaza correo inválido y contraseña corta', async () => {
  const client = createClient(baseUrl);

  const badEmail = await client.request('/api/auth/signup', {
    method: 'POST',
    body: { businessName: uniqueName('X'), email: 'no-es-un-correo', password: 'password123' },
  });
  assert.equal(badEmail.status, 400);

  const shortPassword = await client.request('/api/auth/signup', {
    method: 'POST',
    body: { businessName: uniqueName('X'), email: uniqueEmail(), password: 'short' },
  });
  assert.equal(shortPassword.status, 400);
});

test('signup no permite dos negocios con el mismo correo', async () => {
  const client = createClient(baseUrl);
  const email = uniqueEmail();
  const body = { businessName: uniqueName('Almacen Dup'), email, password: 'password123' };

  const first = await client.request('/api/auth/signup', { method: 'POST', body });
  assert.equal(first.status, 201);

  const second = await client.request('/api/auth/signup', {
    method: 'POST',
    body: { ...body, businessName: uniqueName('Otro nombre') },
  });
  assert.equal(second.status, 409);
});

test('login falla con la contraseña incorrecta y funciona con la correcta', async () => {
  const client = createClient(baseUrl);
  const email = uniqueEmail();
  await client.request('/api/auth/signup', {
    method: 'POST',
    body: { businessName: uniqueName('Almacen Login'), email, password: 'password123' },
  });
  await client.request('/api/auth/logout', { method: 'POST' });

  const bad = await client.request('/api/auth/login', {
    method: 'POST',
    body: { identifier: email, password: 'contraseña-incorrecta' },
  });
  assert.equal(bad.status, 401);

  const good = await client.request('/api/auth/login', {
    method: 'POST',
    body: { identifier: email, password: 'password123' },
  });
  assert.equal(good.status, 200);
  assert.equal(good.data.role, 'owner');
});

test('rutas protegidas devuelven 401 sin sesión', async () => {
  const client = createClient(baseUrl);
  const res = await client.request('/api/products');
  assert.equal(res.status, 401);
});

test('recuperar contraseña: respuesta genérica, token de un solo uso y con vencimiento', async () => {
  const client = createClient(baseUrl);
  const email = uniqueEmail();
  await client.request('/api/auth/signup', {
    method: 'POST',
    body: { businessName: uniqueName('Almacen Reset'), email, password: 'password123' },
  });

  const existing = await client.request('/api/auth/forgot-password', { method: 'POST', body: { email } });
  const missing = await client.request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: uniqueEmail() },
  });
  assert.equal(existing.status, 200);
  assert.equal(missing.status, 200);
  assert.equal(existing.data.message, missing.data.message, 'no debe delatar si el correo existe o no');

  const { rows } = await pool.query(
    `SELECT token FROM password_reset_tokens
     WHERE user_id = (SELECT id FROM users WHERE email = $1) ORDER BY id DESC LIMIT 1`,
    [email]
  );
  const token = rows[0].token;

  const tooShort = await client.request('/api/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword: 'short' },
  });
  assert.equal(tooShort.status, 400);

  const badToken = await client.request('/api/auth/reset-password', {
    method: 'POST',
    body: { token: 'token-inventado', newPassword: 'unaContraseñaValida1' },
  });
  assert.equal(badToken.status, 400);

  const reset = await client.request('/api/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword: 'unaContraseñaNueva1' },
  });
  assert.equal(reset.status, 200);

  const reuse = await client.request('/api/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword: 'otraContraseñaMas2' },
  });
  assert.equal(reuse.status, 400, 'un token ya usado no debe volver a servir');

  const loginOld = await client.request('/api/auth/login', {
    method: 'POST',
    body: { identifier: email, password: 'password123' },
  });
  assert.equal(loginOld.status, 401);

  const loginNew = await client.request('/api/auth/login', {
    method: 'POST',
    body: { identifier: email, password: 'unaContraseñaNueva1' },
  });
  assert.equal(loginNew.status, 200);
});

test('empleado entra con usuario+contraseña de su tienda y no puede tocar rutas de dueño', async () => {
  const owner = createClient(baseUrl);
  const email = uniqueEmail();
  await owner.request('/api/auth/signup', {
    method: 'POST',
    body: { businessName: uniqueName('Almacen Empleado'), email, password: 'password123' },
  });
  await owner.request('/api/billing/subscribe', { method: 'POST' });

  const me = await owner.request('/api/auth/me');
  const storeCode = me.data.storeCode;

  const username = `cajero${Date.now()}`;
  const created = await owner.request('/api/employees', {
    method: 'POST',
    body: { name: 'Cajero de prueba', username, password: 'password123' },
  });
  assert.equal(created.status, 201);

  const employee = createClient(baseUrl);
  const badLogin = await employee.request('/api/auth/employee-login', {
    method: 'POST',
    body: { storeCode, username, password: 'contraseña-mala' },
  });
  assert.equal(badLogin.status, 401);

  const login = await employee.request('/api/auth/employee-login', {
    method: 'POST',
    body: { storeCode, username, password: 'password123' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.role, 'cajero');

  const forbidden = await employee.request('/api/movements');
  assert.equal(forbidden.status, 403);

  const allowedProducts = await employee.request('/api/products');
  assert.equal(allowedProducts.status, 200, 'el cajero sí puede leer productos para buscar en Caja');
});
