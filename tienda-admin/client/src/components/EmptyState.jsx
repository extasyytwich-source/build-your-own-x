import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
      >
        <Icon className="h-6 w-6" />
      </motion.div>
      <div>
        {title && <p className="text-sm font-medium text-slate-600">{title}</p>}
        {message && <p className="mt-0.5 text-xs text-slate-400">{message}</p>}
      </div>
    </div>
  );
}
