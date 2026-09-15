import { Router } from 'express';
import { verifyToken } from '../auth.js';
import { addSubscriber, removeSubscriber } from '../events.js';

export const eventsRouter = Router();

// EventSource (la API nativa del navegador para esto) no puede mandar un
// header Authorization, así que aquí el token viaja como query param en vez
// de por el middleware requireAuth normal.
eventsRouter.get('/stream', (req, res) => {
  const token = req.query.token;
  const payload = token ? verifyToken(String(token)) : null;
  if (!payload) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': conectado\n\n');

  addSubscriber(res, payload.businessId);

  // Mantiene la conexión viva a través de proxies/timeouts intermedios.
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeSubscriber(res);
  });
});
