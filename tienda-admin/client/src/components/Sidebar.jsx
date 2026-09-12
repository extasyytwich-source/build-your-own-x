import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';

const ICONS = {
  dashboard: '📊',
  products: '📦',
  history: '🧾',
  settings: '⚙️',
};

export default function Sidebar({ views, active, onNavigate }) {
  const { logout } = useAuth();

  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-6 sm:w-56 sm:items-stretch sm:px-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg text-white shadow-soft">
          🏪
        </div>
        <span className="hidden text-sm font-semibold text-slate-700 sm:block">
          Panel de la Tienda
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {Object.entries(views).map(([key, { label }]) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
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
              <span className="relative z-10 text-lg">{ICONS[key]}</span>
              <span className="relative z-10 hidden sm:block">{label}</span>
            </button>
          );
        })}
      </nav>

      <button
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 sm:justify-start"
      >
        <span className="text-lg">🚪</span>
        <span className="hidden sm:block">Salir</span>
      </button>
    </aside>
  );
}
