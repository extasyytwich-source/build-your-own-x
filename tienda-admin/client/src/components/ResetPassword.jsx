import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useShake } from '../hooks/useShake.js';
import { IconLock } from './icons.jsx';

// Pantalla a la que llega el enlace del correo de "recuperar contraseña"
// (ver App.jsx: se muestra en vez del login normal cuando la URL trae
// ?resetToken=..., sin importar si hay una sesión vieja abierta en el
// navegador). Un token vencido o ya usado da el mismo error genérico que
// cualquier otro fallo — el backend ya no distingue el motivo.
export default function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [shakeControls, shake] = useShake();

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      shake();
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-950 to-black px-4">
      <motion.div
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

        {done ? (
          <>
            <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">Contraseña actualizada</h1>
            <p className="mb-6 text-center text-xs text-slate-500">
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <button type="button" onClick={onDone} className="btn-primary w-full">
              Ir a iniciar sesión
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">Nueva contraseña</h1>
            <p className="mb-6 text-center text-xs text-slate-500">Elige una nueva contraseña para tu cuenta.</p>

            <motion.div animate={shakeControls} className="space-y-3">
              <input
                autoFocus
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="input"
              />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar nueva contraseña"
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
              {loading ? 'Un momento…' : 'Actualizar contraseña'}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              ← Volver a iniciar sesión
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
