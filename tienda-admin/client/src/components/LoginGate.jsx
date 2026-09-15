import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { useShake } from '../hooks/useShake.js';
import { IconLock } from './icons.jsx';

export default function LoginGate({ initialMode = 'login', onBack }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeControls, shake] = useShake();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') await signup(businessName, email, password);
      else await login(email, password);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-950 to-black px-4">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-soft"
        >
          <IconLock className="h-6 w-6" />
        </motion.div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            ← Volver
          </button>
        )}
        <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">Mostrador</h1>
        <p className="mb-6 text-center text-xs text-slate-500">
          {mode === 'login' ? 'Ingresa a tu panel' : 'Crea la cuenta de tu negocio'}
        </p>

        <div className="mb-5 flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-lg py-1.5 transition ${
              mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 rounded-lg py-1.5 transition ${
              mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <motion.div animate={shakeControls} className="space-y-3">
          {mode === 'signup' && (
            <input
              autoFocus
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Nombre de tu negocio"
              className="input"
            />
          )}
          <input
            autoFocus={mode === 'login'}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            className="input"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="input"
          />
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-3 text-center text-sm text-rose-600"
          >
            {error}
          </motion.p>
        )}

        <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
          {loading ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        {mode === 'signup' && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Después de crear la cuenta te pedimos activar la suscripción mensual.
          </p>
        )}
      </motion.form>
    </div>
  );
}
