import crypto from 'node:crypto';
import { pool } from './db.js';

export const SUBSCRIPTION_AMOUNT_CLP = 20000;
const SUBSCRIPTION_DAYS = 30;
const GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 días de gracia si el pago se demora en confirmarse

const FLOW_BASE_URL = process.env.FLOW_BASE_URL || 'https://sandbox.flow.cl/api';

// Flow firma cada pedido con HMAC-SHA256: todos los parámetros (menos la
// firma misma) se ordenan alfabéticamente por nombre, se concatenan como
// "clave1valor1clave2valor2..." y eso se firma con el secretKey de la cuenta.
function signParams(params, secretKey) {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .sort();
  const toSign = keys.map((k) => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

// NOTA para producción: esta integración usa el endpoint clásico de pago
// único de Flow (payment/create + payment/getStatus), que es el más estable
// y documentado de su API. En vez del cobro 100% automático mes a mes
// (API de "planes"/"suscripciones" de Flow), cada renovación es un nuevo
// pago de $20.000 que el dueño confirma desde Ajustes — más simple de
// integrar correctamente sin acceso a una cuenta Flow real para verificar
// los endpoints de suscripción recurrente. Se puede migrar a cobro
// automático más adelante si hace falta, verificando esos endpoints con
// las llaves de sandbox ya en mano.
async function flowRequest(pathname, params, { method = 'POST' } = {}) {
  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;
  if (!apiKey || !secretKey) {
    const err = new Error('Flow no está configurado (faltan FLOW_API_KEY/FLOW_SECRET_KEY)');
    err.status = 501;
    throw err;
  }

  const fullParams = { ...params, apiKey };
  const s = signParams(fullParams, secretKey);
  const body = new URLSearchParams({ ...fullParams, s });

  const url = method === 'GET' ? `${FLOW_BASE_URL}${pathname}?${body}` : `${FLOW_BASE_URL}${pathname}`;
  const response = await fetch(url, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code) {
    const err = new Error(data.message || 'Error al comunicarse con Flow');
    err.status = 502;
    throw err;
  }
  return data;
}

export async function createPayment({ commerceOrder, subject, amount, email, urlConfirmation, urlReturn }) {
  const data = await flowRequest('/payment/create', {
    commerceOrder,
    subject,
    currency: 'CLP',
    amount,
    email,
    urlConfirmation,
    urlReturn,
  });
  return { url: `${data.url}?token=${data.token}`, token: data.token, flowOrder: data.flowOrder };
}

export async function getPaymentStatus(token) {
  return flowRequest('/payment/getStatus', { token }, { method: 'GET' });
}

export async function activateSubscription(businessId, subscriptionId) {
  const vence = new Date(Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `UPDATE businesses SET subscription_status = 'activa', subscription_id = $1, subscription_vence = $2
     WHERE id = $3`,
    [subscriptionId, vence, businessId]
  );
}

export async function requireActiveSubscription(req, res, next) {
  const { rows } = await pool.query(
    'SELECT subscription_status, subscription_vence FROM businesses WHERE id = $1',
    [req.businessId]
  );
  const business = rows[0];
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const now = new Date();
  const vence = business.subscription_vence ? new Date(business.subscription_vence) : null;

  if (business.subscription_status === 'activa' && vence && vence > now) {
    return next();
  }

  // Recién vencida: deja pasar con un margen corto (por si la confirmación
  // del pago se demora), pero la marca "atrasada" para que Ajustes lo avise.
  if (business.subscription_status !== 'cancelada' && vence && now - vence < GRACE_MS) {
    if (business.subscription_status !== 'atrasada') {
      await pool.query("UPDATE businesses SET subscription_status = 'atrasada' WHERE id = $1", [
        req.businessId,
      ]);
    }
    return next();
  }

  return res.status(402).json({
    error: 'Necesitas completar el pago de tu suscripción para continuar',
    subscriptionStatus: business.subscription_status,
  });
}
