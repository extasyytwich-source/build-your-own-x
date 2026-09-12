import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const from = 0;
    const to = Number(value) || 0;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}

export default function StatCard({ icon, label, value, formatter, accent = 'brand', delay = 0 }) {
  const animated = useCountUp(value);
  const formatted = formatter ? formatter(animated) : Math.round(animated).toLocaleString('es');

  const accentClasses = {
    brand: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className="card flex items-center gap-4 p-5"
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${accentClasses[accent]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="text-2xl font-semibold text-slate-800">{formatted}</p>
      </div>
    </motion.div>
  );
}
