import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import dashboardShot from '../../assets/landing/demo-dashboard.png';
import productsShot from '../../assets/landing/demo-products.png';
import reportsShot from '../../assets/landing/demo-reports.png';

const TABS = [
  {
    key: 'dashboard',
    label: 'Panel',
    caption: 'El valor de tu inventario, el stock bajo y lo más vendido, de un vistazo.',
    image: dashboardShot,
  },
  {
    key: 'products',
    label: 'Productos',
    caption: 'Carga tu catálogo y escanea códigos de barras con un lector o la cámara del teléfono.',
    image: productsShot,
  },
  {
    key: 'reports',
    label: 'Reportes',
    caption: 'Ganancias del mes, qué reponer con urgencia y si la caja cuadra con las ventas.',
    image: reportsShot,
  },
];

export default function DemoShowcase() {
  const [active, setActive] = useState('dashboard');
  const current = TABS.find((t) => t.key === active);
  const reduceMotion = useReducedMotion();

  return (
    <div>
      <div className="mb-6 flex justify-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab.key === active ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab.key === active && (
              <motion.span
                layoutId="demo-tab-pill"
                className="absolute inset-0 rounded-full bg-iris"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-night-border bg-night-card shadow-glow">
        <div className="flex items-center gap-1.5 border-b border-night-border px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-white sm:aspect-[16/9]">
          <AnimatePresence mode="wait">
            <motion.img
              key={current.key}
              src={current.image}
              alt={`Captura real de Mostrador: ${current.label}`}
              loading={current.key === 'dashboard' ? 'eager' : 'lazy'}
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
              transition={{ duration: reduceMotion ? 0.15 : 0.3, ease: 'easeInOut' }}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          </AnimatePresence>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-lg text-center text-sm text-white/60">{current.caption}</p>
    </div>
  );
}
