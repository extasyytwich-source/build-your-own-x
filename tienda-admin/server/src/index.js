import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensurePinConfigured, requireAuth } from './auth.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { movementsRouter } from './routes/movements.js';
import { statsRouter } from './routes/stats.js';
import { cashRouter } from './routes/cash.js';
import { reportsRouter } from './routes/reports.js';
import { settingsRouter } from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Cuando el cliente ya está compilado (npm run build, o empaquetado en la app
// de escritorio), lo servimos desde este mismo servidor en el mismo origen,
// así no hace falta CORS ni un segundo proceso para usar el programa. La ruta
// es relativa a este archivo, así que funciona igual corriendo desde el
// repositorio o desde la copia que arma la app de escritorio.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(clientDist, 'index.html'));

export function createApp() {
  ensurePinConfigured(process.env.ADMIN_PIN || '1234');

  const app = express();
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  if (!hasClientBuild) app.use(cors({ origin: clientOrigin }));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/products', requireAuth, productsRouter);
  app.use('/api/movements', requireAuth, movementsRouter);
  app.use('/api/stats', requireAuth, statsRouter);
  app.use('/api/cash', requireAuth, cashRouter);
  app.use('/api/reports', requireAuth, reportsRouter);
  app.use('/api/settings', requireAuth, settingsRouter);

  if (hasClientBuild) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

// port: 0 deja que el sistema operativo elija un puerto libre (lo usa la app
// de escritorio, para no chocar con otro programa). Resuelve con el puerto
// real en el que quedó escuchando.
export function startServer(options = {}) {
  const app = createApp();
  const requestedPort = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 4000);
  return new Promise((resolve, reject) => {
    const server = app.listen(requestedPort);
    server.once('listening', () => {
      const port = server.address().port;
      console.log(`Tienda Admin API escuchando en http://localhost:${port}`);
      resolve({ server, port });
    });
    server.once('error', reject);
  });
}

// Arranca solo si el archivo se ejecuta directamente (`node src/index.js`),
// no cuando otro módulo (como la app de escritorio) lo importa para controlar
// el arranque él mismo.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  startServer();
}
