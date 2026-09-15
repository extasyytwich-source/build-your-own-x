import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { IconGrid, IconBox, IconReceipt, IconTrendingUp, IconSettings, IconLogOut, IconStore } from './icons.jsx';

const ICONS = {
  dashboard: IconGrid,
  products: IconBox,
  history: IconReceipt,
  reports: IconTrendingUp,
  settings: IconSettings,
};

export default function Sidebar({ views, active, onNavigate }) {
  const { logout } = useAuth();

  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-6 sm:w-56 sm:items-stretch sm:px-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-soft">
          <IconStore className="h-5 w-5" />
        </div>
        <span className="hidden text-sm font-semibold text-slate-700 sm:block">
          Panel de la Tienda
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {Object.entries(views).map(([key, { label }]) => {
          const isActive = key === active;
          const Icon = ICONS[key];
          return (
            <motion.button
              key={key}
              onClick={() => onNavigate(key)}
              whileTap={{ scale: 0.95 }}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-brand-50"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <motion.span
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="relative z-10"
              >
                <Icon className="h-5 w-5" />
              </motion.span>
              <span className="relative z-10 hidden sm:block">{label}</span>
            </motion.button>
          );
        })}
      </nav>

      <motion.button
        onClick={logout}
        whileTap={{ scale: 0.95 }}
        className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 sm:justify-start"
      >
        <IconLogOut className="h-5 w-5" />
        <span className="hidden sm:block">Salir</span>
      </motion.button>
    </aside>
  );
}
