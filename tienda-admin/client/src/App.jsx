import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './context/AuthContext.jsx';
import LoginGate from './components/LoginGate.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import ProductList from './components/ProductList.jsx';
import MovementHistory from './components/MovementHistory.jsx';
import Reports from './components/Reports.jsx';
import Settings from './components/Settings.jsx';

const VIEWS = {
  dashboard: { label: 'Panel', component: Dashboard },
  products: { label: 'Productos', component: ProductList },
  history: { label: 'Historial', component: MovementHistory },
  reports: { label: 'Reportes', component: Reports },
  settings: { label: 'Ajustes', component: Settings },
};

export default function App() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState('dashboard');

  if (!isAuthenticated) return <LoginGate />;

  const ActiveView = VIEWS[view].component;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar views={VIEWS} active={view} onNavigate={setView} />
      <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-8 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <ActiveView />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
