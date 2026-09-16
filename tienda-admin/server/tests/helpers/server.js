import { startServer } from '../../src/index.js';
import { pool } from '../../src/db.js';

// Cada archivo de prueba levanta su propia instancia en un puerto libre
// (port: 0) contra la misma base de Postgres real que apunte DATABASE_URL
// — igual que se probó a mano cada feature de esta sesión, solo que ahora
// queda repetible. Las pruebas no se estorban entre sí porque cada negocio
// de prueba es su propio inquilino (ver uniqueName en client.js).
export async function startTestServer() {
  const { server, port } = await startServer({ port: 0 });
  return {
    baseUrl: `http://localhost:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function closePool() {
  await pool.end();
}
