import { motion, useReducedMotion } from 'framer-motion';

// Grilla tipo "bento" (cajas de distinto tamaño) con aparición en cascada al
// bajar — cada item declara span: 1 o 2 columnas dentro de una grilla de 4.
export default function BentoGrid({ items }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map(({ Icon, title, body, span = 1, accent, extra }, i) => (
        <motion.div
          key={title}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45, delay: i * 0.06, ease: 'easeOut' }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className={`group relative overflow-hidden rounded-2xl border border-night-border bg-night-card p-6 ${
            span === 2 ? 'col-span-2' : 'col-span-1'
          }`}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
            style={{ backgroundColor: accent }}
          />
          <div
            className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accent}26`, color: accent }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-display mb-1.5 text-sm font-semibold text-white">{title}</h3>
          <p className="text-sm leading-relaxed text-white/60">{body}</p>
          {extra && <div className="mt-4">{extra}</div>}
        </motion.div>
      ))}
    </div>
  );
}
