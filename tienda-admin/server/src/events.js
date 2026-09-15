// Notifica en tiempo real a las pantallas conectadas de un mismo negocio (la
// computadora del dueño, la de la caja, el teléfono) cuando algo cambia — así
// el dueño ve un movimiento o un producto nuevo aparecer solo, sin recargar
// la página. Cada suscriptor solo recibe eventos de su propio negocio.
const subscribers = new Map(); // res -> businessId

export function addSubscriber(res, businessId) {
  subscribers.set(res, businessId);
}

export function removeSubscriber(res) {
  subscribers.delete(res);
}

export function broadcast(kind, data, originClientId, businessId) {
  const payload = `event: change\ndata: ${JSON.stringify({ kind, ...data, origin: originClientId || null })}\n\n`;
  for (const [res, subBusinessId] of subscribers) {
    if (subBusinessId === businessId) res.write(payload);
  }
}

export function subscriberCount() {
  return subscribers.size;
}
