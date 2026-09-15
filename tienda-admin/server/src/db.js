import pgPkg from 'pg';
import 'dotenv/config';
import { runMigrations } from './migrate.js';

const { Pool, types } = pgPkg;

// Evita conversiones de node-pg que dependerían de la zona horaria del
// servidor o perderían precisión: las fechas simples quedan como texto
// 'YYYY-MM-DD' tal cual las guardó Postgres, y los números vuelven como
// number de JS en vez de string.
types.setTypeParser(1082, (val) => val); // date
types.setTypeParser(1700, (val) => parseFloat(val)); // numeric
types.setTypeParser(20, (val) => parseInt(val, 10)); // bigint (COUNT)

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tienda_admin_dev';

export const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
});

let readyPromise = null;

// Cada ruta espera esto antes de su primera consulta (ver el middleware en
// index.js), así el servidor no atiende pedidos hasta que las migraciones
// terminaron de correr.
export function ready() {
  if (!readyPromise) readyPromise = runMigrations(pool);
  return readyPromise;
}

export async function getSetting(businessId, key) {
  const { rows } = await pool.query(
    'SELECT value FROM settings WHERE business_id = $1 AND key = $2',
    [businessId, key]
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(businessId, key, value) {
  await pool.query(
    `INSERT INTO settings (business_id, key, value) VALUES ($1, $2, $3)
     ON CONFLICT (business_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [businessId, key, value]
  );
}
