import { motion } from 'framer-motion';

export default function LoadingSpinner({ label = 'Cargando…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-slate-800"
      />
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}
