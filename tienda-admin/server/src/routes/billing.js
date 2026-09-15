import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  createPayment,
  getPaymentStatus,
  activateSubscription,
  SUBSCRIPTION_AMOUNT_CLP,
} from '../billing.js';

export const billingRouter = Router();

billingRouter.get('/status', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT subscription_status, subscription_vence, subscription_exempt FROM businesses WHERE id = $1',
    [req.businessId]
  );
  // Una cuenta exenta se reporta como "activa" al frontend para que nunca
  // vea la pantalla de "Suscríbete", sin importar el estado real del pago.
  const subscriptionStatus = rows[0]?.subscription_exempt
    ? 'activa'
    : rows[0]?.subscription_status ?? null;
  res.json({
    subscriptionStatus,
    subscriptionVence: rows[0]?.subscription_vence ?? null,
    amount: SUBSCRIPTION_AMOUNT_CLP,
  });
});

billingRouter.post('/subscribe', requireAuth, async (req, res) => {
  const businessId = req.businessId;

  // Atajo solo para desarrollo local: sin llaves de Flow configuradas y
  // fuera de producción, activa la suscripción directo para poder probar
  // todo el flujo (registro → panel bloqueado → pago → panel activo) sin
  // una cuenta de Flow real todavía.
  if (process.env.NODE_ENV !== 'production' && !process.env.FLOW_API_KEY) {
    await activateSubscription(businessId, `dev-${Date.now()}`);
    return res.json({ devActivated: true });
  }

  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    const email = rows[0]?.email;
    const publicUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    const payment = await createPayment({
      commerceOrder: `sub-${businessId}-${Date.now()}`,
      subject: 'Suscripción mensual Mostrador',
      amount: SUBSCRIPTION_AMOUNT_CLP,
      email,
      urlConfirmation: `${publicUrl}/api/billing/webhook`,
      urlReturn: `${publicUrl}/`,
    });
    res.json({ url: payment.url });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// Flow llama esto server-a-server cuando el pago se confirma (o falla). Manda
// el "token" del pago; la verificación de verdad es preguntarle a Flow mismo
// por el estado con ese token, nunca confiar en el cuerpo del aviso a ciegas.
billingRouter.post('/webhook', async (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const token = new URLSearchParams(raw).get('token');
    if (!token) return res.sendStatus(400);

    const status = await getPaymentStatus(token);
    const match = /^sub-(\d+)-/.exec(status.commerceOrder || '');
    if (!match) return res.sendStatus(200);

    if (Number(status.status) === 2) {
      await activateSubscription(Number(match[1]), String(status.flowOrder || token));
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Error en webhook de Flow:', err);
    res.sendStatus(500);
  }
});

billingRouter.post('/cancel', requireAuth, async (req, res) => {
  await pool.query("UPDATE businesses SET subscription_status = 'cancelada' WHERE id = $1", [
    req.businessId,
  ]);
  res.json({ ok: true });
});
