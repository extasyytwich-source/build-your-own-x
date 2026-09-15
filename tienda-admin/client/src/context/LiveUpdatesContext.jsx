import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { CLIENT_ID } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const LiveUpdatesContext = createContext(null);

const MESSAGES = {
  movement: (e) =>
    `${e.type === 'entrada' ? 'Entrada' : e.type === 'salida' ? 'Salida' : 'Ajuste'} registrada: ${e.productName} (${e.quantity})`,
  product: (e) =>
    e.action === 'created'
      ? `Producto agregado: ${e.name}`
      : e.action === 'deleted'
        ? `Producto eliminado: ${e.name}`
        : `Producto actualizado: ${e.name}`,
  cash: (e) => (e.action === 'created' ? 'Nuevo registro de caja' : 'Registro de caja eliminado'),
  sale: (e) =>
    `Venta registrada: ${e.items} producto${e.items === 1 ? '' : 's'} por ${Number(e.total).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}`,
};

// Mantiene una sola conexión en tiempo real (Server-Sent Events) mientras
// haya sesión, para que la computadora del dueño, la de la caja y el
// teléfono se vean reflejados entre sí sin recargar la página.
export function LiveUpdatesProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const { notify } = useToast();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    if (!isAuthenticated) {
      setConnected(false);
      return undefined;
    }
    // EventSource manda la cookie de sesión sola (mismo origen), no hace
    // falta pasar ningún token por la URL.
    const source = new EventSource('/api/events/stream', { withCredentials: true });
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener('change', (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      setLastEvent({ ...data, receivedAt: Date.now() });
      if (data.origin !== CLIENT_ID) {
        const buildMessage = MESSAGES[data.kind];
        if (buildMessage) notifyRef.current(buildMessage(data));
      }
    });

    return () => source.close();
  }, [isAuthenticated]);

  return (
    <LiveUpdatesContext.Provider value={{ connected, lastEvent }}>
      {children}
    </LiveUpdatesContext.Provider>
  );
}

export function useLiveUpdates() {
  const ctx = useContext(LiveUpdatesContext);
  if (!ctx) throw new Error('useLiveUpdates debe usarse dentro de <LiveUpdatesProvider>');
  return ctx;
}
