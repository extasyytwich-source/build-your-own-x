import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/LiveUpdatesContext.jsx';
import StatCard from './StatCard.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { IconBox, IconCoins, IconAlertTriangle, IconTrendingUp } from './icons.jsx';

const currency = (n) =>
  Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { handleUnauthorized } = useAuth();
  const { notify } = useToast();
  const { lastEvent } = useLiveUpdates();

  useEffect(() => {
    let active = true;
    api
      .getStats()
      .then((data) => active && setStats(data))
      .catch((err) => {
        if (err.status === 401) return handleUnauthorized();
        notify(err.message, 'error');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Actualización silenciosa cuando otra pantalla conectada (la caja, el
    // teléfono) registra algo — sin mostrar de nuevo el spinner de carga.
    if (!lastEvent) return;
    api.getStats().then(setStats).catch(() => {});
  }, [lastEvent]);

  if (loading) {
    return <LoadingSpinner label="Cargando panel…" />;
  }

  if (!stats) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Panel general</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<IconBox className="h-5 w-5" />}
          label="Productos activos"
          value={stats.totalProducts}
          accent="brand"
          delay={0}
        />
        <StatCard
          icon={<IconCoins className="h-5 w-5" />}
          label="Valor del inventario"
          value={stats.totalStockValue}
          formatter={currency}
          accent="emerald"
          delay={0.05}
        />
        <StatCard
          icon={<IconAlertTriangle className="h-5 w-5" />}
          label="Stock bajo"
          value={stats.lowStockCount}
          accent="amber"
          delay={0.1}
        />
        <StatCard
          icon={<IconTrendingUp className="h-5 w-5" />}
          label="Movimientos hoy"
          value={stats.movementsToday}
          accent="rose"
          delay={0.15}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5"
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <IconAlertTriangle className="h-4 w-4 text-amber-500" />
            Stock bajo mínimo
          </h2>
          {stats.lowStockProducts.length === 0 ? (
            <p className="text-sm text-slate-400">Ningún producto por debajo de su mínimo.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.lowStockProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {p.stock} / {p.minStock} {p.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-5"
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <IconTrendingUp className="h-4 w-4 text-brand-500" />
            Más vendidos
          </h2>
          {stats.topUsedProducts.length === 0 ? (
            <p className="text-sm text-slate-400">Sin salidas registradas este mes.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.topUsedProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    {p.totalSalida} usados
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    </div>
  );
}
