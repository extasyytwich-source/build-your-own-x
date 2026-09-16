import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const WORDS = [
  { text: 'más ventas', className: 'font-playfair italic text-coral' },
  { text: 'más control', className: 'font-syne font-bold text-aqua' },
  { text: 'menos estrés', className: 'font-instrument italic text-golden' },
  { text: 'más clientes', className: 'font-display text-blossom' },
];

const INTERVAL_MS = 1400;

// La palabra final del titular del hero rota cada 1,4s, cambiando de
// tipografía y color en cada vuelta — la única pieza "ruidosa" del hero, el
// resto de la página se mueve mucho más despacio.
export default function RotatingWord() {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const current = WORDS[reduceMotion ? 0 : index];

  return (
    <span className="relative inline-grid" style={{ minWidth: '9ch' }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={current.text}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, filter: 'blur(6px)' }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`col-start-1 row-start-1 inline-block whitespace-nowrap ${current.className}`}
        >
          {current.text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
