import { motion } from 'framer-motion';

// Barras puramente decorativas (sin cifras que insinúen un resultado real)
// que crecen al entrar en pantalla — el motivo visual que pide el brief
// para acompañar la idea de "reportes", sin fabricar una métrica de venta.
const HEIGHTS = [38, 62, 45, 80, 58, 96];

export default function MiniBars() {
  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden="true">
      {HEIGHTS.map((h, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
          style={{ height: `${h}%`, transformOrigin: 'bottom' }}
          className="w-2.5 flex-1 rounded-full bg-gradient-to-t from-iris to-aqua"
        />
      ))}
    </div>
  );
}
