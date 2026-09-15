import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensurePinConfigured, requireAuth } from './auth.js';
import { getOrCreateHttpsCert } from './https-cert.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { movementsRouter } from './routes/movements.js';
import { statsRouter } from './routes/stats.js';
import { cashRouter } from './routes/cash.js';
import { reportsRouter } from './routes/reports.js';
import { settingsRouter } from './routes/settings.js';
import { eventsRouter } from './routes/events.js';

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
  // Sin requireAuth: EventSource no puede mandar el header Authorization,
  // así que el token se valida a mano dentro de este router (por query param).
  app.use('/api/events', eventsRouter);
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
//
// HTTPS: los navegadores solo dan acceso a la cámara (para escanear códigos
// de barras) en conexiones seguras, y eso incluye abrir el panel desde el
// teléfono por la IP de la red local (no solo "localhost"). Por eso, cuando
// el cliente ya está compilado (el caso real de uso: la app empaquetada o
// "npm run build" en producción), el servidor usa un certificado autofirmado
// propio en vez de HTTP simple.
export async function startServer(options = {}) {
  const app = createApp();
  const requestedPort = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 4000);
  const useHttps = options.https ?? (process.env.HTTPS === 'false' ? false : hasClientBuild);
  const server = useHttps ? https.createServer(await getOrCreateHttpsCert(), app) : app;

  return new Promise((resolve, reject) => {
    const listening = server.listen(requestedPort);
    listening.once('listening', () => {
      const port = listening.address().port;
      const protocol = useHttps ? 'https' : 'http';
      console.log(`Tienda Admin API escuchando en ${protocol}://localhost:${port}`);
      resolve({ server: listening, port, protocol });
    });
    listening.once('error', reject);
  });
}

// Arranca solo si el archivo se ejecuta directamente (`node src/index.js`),
// no cuando otro módulo (como la app de escritorio) lo importa para controlar
// el arranque él mismo.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  startServer();
}
