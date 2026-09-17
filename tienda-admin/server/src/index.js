import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireAuth, requireOwner } from './auth.js';
import { ready } from './db.js';
import { authRouter } from './routes/auth.js';
import { billingRouter } from './routes/billing.js';
import { productsRouter } from './routes/products.js';
import { movementsRouter } from './routes/movements.js';
import { statsRouter } from './routes/stats.js';
import { cashRouter } from './routes/cash.js';
import { reportsRouter } from './routes/reports.js';
import { settingsRouter } from './routes/settings.js';
import { employeesRouter } from './routes/employees.js';
import { salesRouter } from './routes/sales.js';
import { refundsRouter } from './routes/refunds.js';
import { suppliersRouter } from './routes/suppliers.js';
import { locationsRouter } from './routes/locations.js';
import { dteRouter } from './routes/dte.js';
import { purchaseOrdersRouter } from './routes/purchaseOrders.js';
import { telegramRouter } from './routes/telegram.js';
import { telegramWebhookRouter } from './routes/telegramWebhook.js';
import { eventsRouter } from './routes/events.js';
import { insightsRouter } from './routes/insights.js';
import { requireActiveSubscription } from './billing.js';
import { registerWebhook } from './telegram.js';
import { startInsightScheduler } from './scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Cuando el cliente ya está compilado (npm run build, o el modo producción
// desplegado), lo servimos desde este mismo servidor en el mismo origen, así
// no hace falta CORS ni un segundo proceso para usar el programa.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(clientDist, 'index.html'));

// Frena fuerza bruta / credential stuffing contra login, registro y
// cambio de contraseña: un mismo IP no puede reintentar sin límite.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

export function createApp() {
  const app = express();
  // Necesario detrás del proxy de Render (u otro hosting) para que la IP
  // real llegue al rate limiter y para que Express sepa que la conexión
  // original es HTTPS (importante para la cookie "secure").
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // El botón de "Iniciar sesión con Google" carga su script y su
          // iframe/popup desde accounts.google.com; sin esto, la política
          // por defecto de helmet lo bloquearía.
          'script-src': ["'self'", 'https://accounts.google.com'],
          'frame-src': ["'self'", 'https://accounts.google.com'],
          'connect-src': ["'self'", 'https://accounts.google.com'],
        },
      },
    })
  );

  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  // credentials:true porque la sesión ahora viaja en una cookie: sin esto
  // el navegador no la manda ni la deja setear en pedidos cross-origin
  // (el caso del cliente de desarrollo, en otro puerto que la API).
  if (!hasClientBuild) app.use(cors({ origin: clientOrigin, credentials: true }));

  app.use(cookieParser());

  // El webhook de Flow necesita el cuerpo crudo (sin parsear) para poder
  // verificar la firma, así que se monta antes que express.json().
  app.use('/api/billing/webhook', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '20mb' }));

  // Espera a que las migraciones terminen antes de atender cualquier pedido.
  app.use(async (req, res, next) => {
    try {
      await ready();
      next();
    } catch (err) {
      console.error('Error al preparar la base de datos:', err);
      res.status(503).json({ error: 'El servidor no está listo, intenta de nuevo en un momento' });
    }
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/events', eventsRouter);
  // products: lectura compartida (el cajero busca/escanea para el carrito),
  // la escritura (alta/edición/borrado) queda restringida dentro del propio
  // router con requireOwner en cada ruta que corresponde.
  app.use('/api/products', requireAuth, requireActiveSubscription, productsRouter);
  // El resto es exclusivo del dueño: el cajero solo vende (routes/sales.js).
  app.use('/api/movements', requireAuth, requireActiveSubscription, requireOwner, movementsRouter);
  app.use('/api/stats', requireAuth, requireActiveSubscription, requireOwner, statsRouter);
  app.use('/api/cash', requireAuth, requireActiveSubscription, requireOwner, cashRouter);
  app.use('/api/reports', requireAuth, requireActiveSubscription, requireOwner, reportsRouter);
  app.use('/api/settings', requireAuth, requireActiveSubscription, requireOwner, settingsRouter);
  app.use('/api/employees', requireAuth, requireActiveSubscription, requireOwner, employeesRouter);
  app.use('/api/suppliers', requireAuth, requireActiveSubscription, requireOwner, suppliersRouter);
  // Lectura compartida (Caja necesita listar sucursales para elegir dónde
  // vender); la escritura queda restringida dentro del propio router.
  app.use('/api/locations', requireAuth, requireActiveSubscription, locationsRouter);
  app.use('/api/dte', requireAuth, requireActiveSubscription, requireOwner, dteRouter);
  app.use('/api/purchase-orders', requireAuth, requireActiveSubscription, requireOwner, purchaseOrdersRouter);
  // Cobrar es lo único que necesita el cajero: compartido entre owner y cajero.
  app.use('/api/sales', requireAuth, requireActiveSubscription, salesRouter);
  // Las devoluciones las autoriza el dueño, no el cajero.
  app.use('/api/refunds', requireAuth, requireActiveSubscription, requireOwner, refundsRouter);
  // El webhook (público, lo llama Telegram) va montado antes que las rutas
  // de dueño con el mismo prefijo, para que no le apliquen requireAuth.
  app.use('/api/telegram/webhook', telegramWebhookRouter);
  app.use('/api/telegram', requireAuth, requireActiveSubscription, requireOwner, telegramRouter);
  app.use('/api/insights', requireAuth, requireActiveSubscription, requireOwner, insightsRouter);

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

// port: 0 deja que el sistema operativo elija un puerto libre. Resuelve con
// el puerto real en el que quedó escuchando.
export async function startServer(options = {}) {
  const app = createApp();
  await ready();
  // Sin efecto si no hay TELEGRAM_BOT_TOKEN o PUBLIC_URL (típico en
  // desarrollo local, donde Telegram no puede llamar a localhost).
  registerWebhook(process.env.PUBLIC_URL);
  startInsightScheduler();
  const requestedPort = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 4000);

  return new Promise((resolve, reject) => {
    const listening = app.listen(requestedPort);
    listening.once('listening', () => {
      const port = listening.address().port;
      console.log(`Mostrador API escuchando en http://localhost:${port}`);
      resolve({ server: listening, port, protocol: 'http' });
    });
    listening.once('error', reject);
  });
}

// Arranca solo si el archivo se ejecuta directamente (`node src/index.js`),
// no cuando otro módulo lo importa para controlar el arranque él mismo.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  startServer();
}
