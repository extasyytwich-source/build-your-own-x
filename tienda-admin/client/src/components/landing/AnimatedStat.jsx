import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '../StatCard.jsx';

// El contador solo empieza a animar cuando la tarjeta entra en pantalla: se le
// pasa 0 a useCountUp hasta ese momento, y recién ahí el valor real, para que
// reaproveche la misma lógica de easing que ya usa StatCard sin arrancar antes
// de que el usuario llegue a esta sección.
export default function AnimatedStat({ icon, value, label, formatter, delay = 0 }) {
  const [started, setStarted] = useState(false);
  const animated = useCountUp(started ? value : 0);
  const formatted = formatter ? formatter(animated) : Math.round(animated).toLocaleString('es-CL');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      onViewportEnter={() => setStarted(true)}
      transition={{ duration: 0.4, delay }}
      className="card p-6 text-center"
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
        {icon}
      </div>
      <p className="text-3xl font-semibold text-slate-900">{formatted}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </motion.div>
  );
}
