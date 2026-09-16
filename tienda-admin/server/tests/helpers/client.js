// Cliente HTTP mínimo para las pruebas de integración: guarda la cookie de
// sesión entre pedidos (como haría un navegador) sin depender de ninguna
// librería nueva — el mismo `fetch` global que ya usa el resto del server
// para hablar con Telegram/Flow/Resend alcanza para hablar con uno mismo.
export function createClient(baseUrl) {
  let cookie = null;

  async function request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];

    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  // Para respuestas que no son JSON (PDFs, CSVs) — misma cookie de sesión,
  // pero devuelve el Response crudo para que la prueba lea el body como
  // corresponda.
  async function requestRaw(path) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    return fetch(`${baseUrl}${path}`, { headers });
  }

  return { request, requestRaw };
}

// Nombres únicos por corrida para que las pruebas puedan correr en paralelo
// (o repetirse sin limpiar la base) sin pisarse entre sí — cada negocio de
// prueba es su propio inquilino, aislado como cualquier negocio real.
let counter = 0;
export function uniqueName(prefix) {
  counter += 1;
  return `${prefix} ${Date.now()}-${counter}`;
}

export function uniqueEmail() {
  counter += 1;
  return `test-${Date.now()}-${counter}@example.com`;
}

// Crea un negocio nuevo y activa su suscripción con el atajo de desarrollo
// (ver routes/billing.js) para poder probar el resto del panel sin
// necesitar credenciales reales de Flow.
export async function signUpAndActivate(baseUrl, { businessName, email, password = 'password123' } = {}) {
  const client = createClient(baseUrl);
  const name = businessName || uniqueName('Negocio de prueba');
  const mail = email || uniqueEmail();

  const signup = await client.request('/api/auth/signup', {
    method: 'POST',
    body: { businessName: name, email: mail, password },
  });
  if (signup.status !== 201) {
    throw new Error(`No se pudo crear el negocio de prueba: ${JSON.stringify(signup.data)}`);
  }

  const subscribe = await client.request('/api/billing/subscribe', { method: 'POST' });
  if (subscribe.status !== 200) {
    throw new Error(`No se pudo activar la suscripción de prueba: ${JSON.stringify(subscribe.data)}`);
  }

  return { client, businessName: name, email: mail, password };
}
