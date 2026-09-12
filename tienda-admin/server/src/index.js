import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensurePinConfigured, requireAuth } from './auth.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { movementsRouter } from './routes/movements.js';
import { statsRouter } from './routes/stats.js';

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

ensurePinConfigured(process.env.ADMIN_PIN || '1234');

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/products', requireAuth, productsRouter);
app.use('/api/movements', requireAuth, movementsRouter);
app.use('/api/stats', requireAuth, statsRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Tienda Admin API escuchando en http://localhost:${PORT}`);
});
