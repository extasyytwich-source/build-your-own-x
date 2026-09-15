// Notifica en tiempo real a todas las pantallas conectadas (la computadora
// del dueño, la de la caja, el teléfono) cuando algo cambia — así el dueño
// ve un movimiento o un producto nuevo aparecer solo, sin recargar la página.
const subscribers = new Set();

export function addSubscriber(res) {
  subscribers.add(res);
}

export function removeSubscriber(res) {
  subscribers.delete(res);
}

export function broadcast(kind, data, originClientId) {
  const payload = `event: change\ndata: ${JSON.stringify({ kind, ...data, origin: originClientId || null })}\n\n`;
  for (const res of subscribers) {
    res.write(payload);
  }
}

export function subscriberCount() {
  return subscribers.size;
}
