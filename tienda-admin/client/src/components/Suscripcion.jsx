import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { IconLock } from './icons.jsx';

const STATUS_COPY = {
  pendiente_pago: {
    title: 'Activa tu suscripción',
    body: 'Antes de entrar al panel, activa la suscripción mensual de tu negocio.',
  },
  atrasada: {
    title: 'Tu suscripción está atrasada',
    body: 'El último cobro no se pudo confirmar todavía. Paga ahora para no perder el acceso.',
  },
  cancelada: {
    title: 'Tu suscripción está cancelada',
    body: 'Reactívala para volver a usar el panel. Tus datos siguen guardados, no se pierden.',
  },
};

export default function Suscripcion() {
  const { subscriptionStatus, refreshSubscriptionStatus, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const { notify } = useToast();

  const copy = STATUS_COPY[subscriptionStatus] || STATUS_COPY.pendiente_pago;

  async function handleSubscribe() {
    setLoading(true);
    try {
      const result = await api.subscribe();
      if (result.devActivated) {
        notify('Suscripción activada (modo de desarrollo, sin Flow configurado)');
        await refreshSubscriptionStatus();
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-950 to-black px-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-2xl bg-white/95 p-8 text-center shadow-2xl backdrop-blur"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-soft">
          <IconLock className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-800">{copy.title}</h1>
        <p className="mb-6 text-sm text-slate-500">{copy.body}</p>

        <div className="mb-6 rounded-xl bg-slate-50 p-4">
          <p className="text-3xl font-semibold text-slate-800">$20.000</p>
          <p className="text-xs text-slate-500">CLP por mes, todo incluido</p>
        </div>

        <button onClick={handleSubscribe} disabled={loading} className="btn-primary w-full">
          {loading ? 'Un momento…' : 'Pagar y activar'}
        </button>
        <button onClick={logout} className="mt-3 text-xs text-slate-400 underline">
          Cerrar sesión
        </button>
      </motion.div>
    </div>
  );
}
