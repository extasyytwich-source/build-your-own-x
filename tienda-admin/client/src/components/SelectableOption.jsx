import { motion, AnimatePresence } from 'framer-motion';
import { IconCheck } from './icons.jsx';

/**
 * Botón de opción con el mismo lenguaje visual que el resaltado animado del
 * menú lateral: el fondo se desliza entre opciones (layoutId compartido) en
 * vez de simplemente aparecer, y un check animado confirma la selección.
 */
export default function SelectableOption({
  selected,
  onClick,
  layoutId,
  activeClassName = 'border-brand-400 text-brand-700',
  idleClassName = 'border-slate-200 text-slate-600 hover:bg-slate-50',
  highlightClassName = 'bg-brand-50',
  showCheck = true,
  className = '',
  children,
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`relative flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        selected ? activeClassName : idleClassName
      } ${className}`}
    >
      {selected && (
        <motion.span
          layoutId={layoutId}
          className={`absolute inset-0 ${highlightClassName}`}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        />
      )}
      <span className="relative z-10 flex flex-1 items-center gap-2">{children}</span>
      {showCheck && (
        <AnimatePresence>
          {selected && (
            <motion.span
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative z-10 text-current"
            >
              <IconCheck className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
      )}
    </motion.button>
  );
}
