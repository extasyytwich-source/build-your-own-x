import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { addSubscriber, removeSubscriber } from '../events.js';

export const eventsRouter = Router();

// EventSource (la API nativa del navegador para esto) no puede mandar
// headers propios, pero sí manda cookies en pedidos del mismo origen, así
// que la cookie de sesión de siempre alcanza acá también.
eventsRouter.get('/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': conectado\n\n');

  addSubscriber(res, req.businessId);

  // Mantiene la conexión viva a través de proxies/timeouts intermedios.
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeSubscriber(res);
  });
});
