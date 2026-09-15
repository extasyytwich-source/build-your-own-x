import fs from 'node:fs';
import { db, dbPath } from './db.js';

// Vuelca el WAL antes de copiar, para que la copia sea un snapshot completo
// y no le falten los cambios más recientes que aún no se escribieron al
// archivo principal.
export function createBackupCopy(destPath) {
  db.pragma('wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(dbPath, destPath);
}
