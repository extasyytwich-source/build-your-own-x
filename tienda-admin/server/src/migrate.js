import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

// Clave arbitraria para el advisory lock de abajo — solo tiene que ser la
// misma en todas las instancias de esta app contra la misma base.
const MIGRATION_LOCK_KEY = 823_451_009;

// Runner simple: cada archivo .sql en migrations/ se aplica una sola vez,
// en orden alfabético, dentro de una transacción. Ya aplicados quedan
// registrados en schema_migrations para no repetirlos en el próximo arranque.
//
// El advisory lock serializa esto entre procesos concurrentes contra la
// MISMA base (varias instancias del server arrancando a la vez en un
// despliegue, o los distintos archivos de prueba de esta suite): sin él,
// dos procesos que arrancan contra una base recién creada pueden ver "no
// hay ninguna migración aplicada todavía" al mismo tiempo y chocar
// intentando crear las mismas tablas.
export async function runMigrations(pool) {
  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    await lockClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await lockClient.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (rows.length) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await lockClient.query('BEGIN');
        await lockClient.query(sql);
        await lockClient.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await lockClient.query('COMMIT');
        console.log(`Migración aplicada: ${file}`);
      } catch (err) {
        await lockClient.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    lockClient.release();
  }
}
