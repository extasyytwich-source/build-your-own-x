import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/LiveUpdatesContext.jsx';
import StatCard from './StatCard.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { IconBox, IconCoins, IconAlertTriangle, IconTrendingUp, IconSparkles } from './icons.jsx';

const currency = (n) =>
  Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState({ daily: null, weekly: null });
  const [loading, setLoading] = useState(true);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [weeklyError, setWeeklyError] = useState('');
  const { handleUnauthorized } = useAuth();
  const { notify } = useToast();
  const { lastEvent } = useLiveUpdates();

  useEffect(() => {
    let active = true;
    Promise.all([api.getStats(), api.getLatestInsights()])
      .then(([statsData, insightsData]) => {
        if (!active) return;
        setStats(statsData);
        setInsights(insightsData);
      })
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

  async function handleGenerateWeekly() {
    setGeneratingWeekly(true);
    setWeeklyError('');
    try {
      const weekly = await api.generateWeeklyInsights();
      setInsights((prev) => ({ ...prev, weekly }));
      notify('Recomendación de compra generada');
    } catch (err) {
      if (err.status === 401) return handleUnauthorized();
      setWeeklyError(err.message);
    } finally {
      setGeneratingWeekly(false);
    }
  }

  if (loading) {
    return <LoadingSpinner label="Cargando panel…" />;
  }

  if (!stats) return null;

  const { daily, weekly } = insights;

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

      {daily?.items?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="card mt-6 border border-rose-100 bg-rose-50/40 p-5"
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-rose-700">
            <IconAlertTriangle className="h-4 w-4" />
            Se agota hoy o mañana
          </h2>
          <ul className="divide-y divide-rose-100/70">
            {daily.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-slate-700">{item.name}</span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  {item.stock} {item.unit}
                  {item.daysOfSupply != null ? ` · ~${item.daysOfSupply}d` : ' · agotado'}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card mt-6 p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <IconSparkles className="h-4 w-4 text-brand-500" />
            Recomendación de compra de la semana
          </h2>
          <button onClick={handleGenerateWeekly} disabled={generatingWeekly} className="btn-secondary">
            {generatingWeekly ? 'Generando…' : weekly ? 'Generar ahora' : 'Generar recomendación'}
          </button>
        </div>

        {weeklyError && (
          <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">{weeklyError}</div>
        )}

        {generatingWeekly ? (
          <div className="py-6 text-center text-sm text-slate-400">Calculando qué conviene comprar…</div>
        ) : weekly?.items?.length > 0 ? (
          <div>
            {weekly.summary && (
              <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {weekly.summary}
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {weekly.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{item.name}</span>
                  <span className="text-right text-xs text-slate-500">
                    Pedir <span className="font-semibold text-slate-700">{item.suggestedQty} {item.unit}</span>
                    {' '}
                    {item.orderNow ? 'ahora' : `antes del ${item.suggestedOrderBy}`}
                  </span>
                </li>
              ))}
            </ul>
            {weekly.generatedAt && (
              <p className="mt-3 text-xs text-slate-400">
                Generado el {new Date(weekly.generatedAt).toLocaleString('es')}
              </p>
            )}
          </div>
        ) : (
          !weeklyError && (
            <p className="text-sm text-slate-400">
              Todavía no hay una recomendación esta semana — nada se ve urgente, o falta generarla.
            </p>
          )
        )}
      </motion.div>
    </div>
  );
}
