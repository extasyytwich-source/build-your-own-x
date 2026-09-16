import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './components/Landing.jsx';
import LoginGate from './components/LoginGate.jsx';
import ResetPassword from './components/ResetPassword.jsx';
import Suscripcion from './components/Suscripcion.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import ProductList from './components/ProductList.jsx';
import MovementHistory from './components/MovementHistory.jsx';
import Reports from './components/Reports.jsx';
import Settings from './components/Settings.jsx';
import Caja from './components/Caja.jsx';
import Purchases from './components/Purchases.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';

const VIEWS = {
  dashboard: { label: 'Panel', component: Dashboard },
  caja: { label: 'Caja', component: Caja },
  products: { label: 'Productos', component: ProductList },
  purchases: { label: 'Compras', component: Purchases },
  history: { label: 'Historial', component: MovementHistory },
  reports: { label: 'Reportes', component: Reports },
  settings: { label: 'Ajustes', component: Settings },
};

export default function App() {
  const { isAuthenticated, role, subscriptionStatus, checkingSubscription, justCompletedSignup, logout } =
    useAuth();
  const [view, setView] = useState('dashboard');
  const [authView, setAuthView] = useState(null); // null (landing) | 'login' | 'signup'
  // El enlace del correo de "recuperar contraseña" trae este parámetro — se
  // muestra esa pantalla en vez de lo que sea que toque normalmente, haya o
  // no una sesión vieja abierta en este navegador.
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken'));
  const [resetTokenConsumed, setResetTokenConsumed] = useState(false);

  // Recién registró su negocio y terminó de pagar: en vez de entrar directo
  // al panel, cierra la sesión y vuelve al selector "soy dueño o empleado"
  // — entra ahí como cualquier otro, con las credenciales que acaba de crear.
  useEffect(() => {
    if (isAuthenticated && justCompletedSignup && subscriptionStatus === 'activa') {
      logout().then(() => setAuthView('login'));
    }
  }, [isAuthenticated, justCompletedSignup, subscriptionStatus, logout]);

  if (resetToken && !resetTokenConsumed) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setResetTokenConsumed(true);
          setAuthView('login');
        }}
      />
    );
  }

  if (!isAuthenticated) {
    if (!authView) {
      return <Landing onGetStarted={() => setAuthView('signup')} onLogin={() => setAuthView('login')} />;
    }
    return <LoginGate initialMode={authView} onBack={() => setAuthView(null)} />;
  }
  if (checkingSubscription || (justCompletedSignup && subscriptionStatus === 'activa')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    );
  }
  if (subscriptionStatus && subscriptionStatus !== 'activa' && subscriptionStatus !== 'atrasada') {
    return <Suscripcion />;
  }

  // Un empleado (cajero) solo ve la pantalla de venta, sin el resto del
  // panel (productos, historial, reportes, ajustes, suscripción) — Caja
  // trae su propia barra simple con "Salir", no pasa por el Sidebar.
  if (role === 'cajero') {
    return <Caja />;
  }

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
