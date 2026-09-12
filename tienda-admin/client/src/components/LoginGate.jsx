import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginGate() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(pin);
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 px-4">
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
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white shadow-soft"
        >
          🔒
        </motion.div>
        <h1 className="text-center text-xl font-semibold text-slate-800">Panel de la Tienda</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Acceso privado. Ingresa el PIN para continuar.
        </p>

        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={16}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="input mb-3 text-center text-lg tracking-[0.5em]"
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-3 text-center text-sm text-rose-600"
          >
            {error}
          </motion.p>
        )}

        <button type="submit" disabled={loading || !pin} className="btn-primary w-full">
          {loading ? 'Verificando…' : 'Entrar'}
        </button>
      </motion.form>
    </div>
  );
}
