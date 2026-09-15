import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { useLiveUpdates } from '../context/LiveUpdatesContext.jsx';
import {
  IconGrid,
  IconBox,
  IconReceipt,
  IconTrendingUp,
  IconSettings,
  IconLogOut,
  IconStore,
  IconWifi,
} from './icons.jsx';

const ICONS = {
  dashboard: IconGrid,
  products: IconBox,
  history: IconReceipt,
  reports: IconTrendingUp,
  settings: IconSettings,
};

export default function Sidebar({ views, active, onNavigate }) {
  const { logout } = useAuth();
  const { connected } = useLiveUpdates();

  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-2 bg-black py-6 sm:w-56 sm:items-stretch sm:px-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
          <IconStore className="h-5 w-5" />
        </div>
        <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
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
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-white/10"
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
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-dot"
                  className="absolute right-2.5 hidden h-1.5 w-1.5 rounded-full bg-white sm:block"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      <div
        className={`mb-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium sm:justify-start ${
          connected ? 'text-emerald-400' : 'text-zinc-600'
        }`}
        title={
          connected
            ? 'Conectado en tiempo real con las demás pantallas (caja, teléfono)'
            : 'Sin conexión en tiempo real'
        }
      >
        <motion.span
          animate={connected ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
          transition={{ duration: 2, repeat: connected ? Infinity : 0 }}
        >
          <IconWifi className="h-4 w-4" />
        </motion.span>
        <span className="hidden sm:block">{connected ? 'En vivo' : 'Sin conexión'}</span>
      </div>

      <motion.button
        onClick={logout}
        whileTap={{ scale: 0.95 }}
        className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-white/5 hover:text-white sm:justify-start"
      >
        <IconLogOut className="h-5 w-5" />
        <span className="hidden sm:block">Salir</span>
      </motion.button>
    </aside>
  );
}
