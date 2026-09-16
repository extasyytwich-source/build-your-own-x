import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { useShake } from '../hooks/useShake.js';
import { IconLock, IconStore, IconUsers, IconCamera } from './icons.jsx';
import GoogleSignInButton from './GoogleSignInButton.jsx';

const CameraScannerModal = lazy(() => import('./CameraScannerModal.jsx'));
const CAMERA_SUPPORTED = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

export default function LoginGate({ initialMode = 'login', onBack }) {
  const { login, signup, loginWithGoogle, loginEmployee, loginWithQr } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  // Solo el login se separa por quién entra — crear cuenta es siempre del
  // dueño (un negocio nuevo), así que arranca directo en 'owner'.
  const [audience, setAudience] = useState(initialMode === 'signup' ? 'owner' : null); // null | 'owner' | 'employee'
  // Al iniciar sesión (no al crear cuenta), primero se identifica la tienda
  // por su nombre — recién con eso resuelto aparece el selector de rol. El
  // código de tienda que devuelve (ver auth.js del server) se usa después
  // para el login manual de un empleado, sin que tenga que volver a
  // escribirlo.
  const [businessQuery, setBusinessQuery] = useState('');
  const [resolvedBusiness, setResolvedBusiness] = useState(null); // { name, storeCode } | null
  const [lookingUpBusiness, setLookingUpBusiness] = useState(false);
  const [employeeStep, setEmployeeStep] = useState('choice'); // 'choice' | 'scan' | 'manual'
  const [businessName, setBusinessName] = useState('');
  // En registro es siempre un correo (el dueño); en login del dueño también.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [employeeUsername, setEmployeeUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeControls, shake] = useShake();

  // "¿Olvidaste tu contraseña?" solo aplica al dueño (el empleado entra con
  // usuario, sin correo real que recibir un enlace). null = no se está
  // mostrando; 'form' = pidiendo el correo; 'sent' = ya se envió (o no —
  // el mensaje es el mismo a propósito, ver routes/auth.js).
  const [forgotStep, setForgotStep] = useState(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Cuando Google confirma la identidad de alguien que nunca se registró
  // acá, hace falta el nombre del negocio (Google no lo sabe) antes de
  // poder crear la cuenta — el credential se reenvía junto con ese nombre.
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState(null);
  const [googleBusinessName, setGoogleBusinessName] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') await signup(businessName, identifier, password);
      else await login(identifier, password);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  }

  async function handleEmployeeSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginEmployee(resolvedBusiness.storeCode, employeeUsername, password);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const { message } = await api.forgotPassword(forgotEmail);
      setForgotStep('sent');
      setError('');
      setForgotError(message);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleBusinessLookup(e) {
    e.preventDefault();
    setError('');
    setLookingUpBusiness(true);
    try {
      const result = await api.lookupBusiness(businessQuery);
      setResolvedBusiness(result);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLookingUpBusiness(false);
    }
  }

  async function handleQrDetected(token) {
    setEmployeeStep('choice');
    setError('');
    setLoading(true);
    try {
      await loginWithQr(token);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(credential) {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle(credential);
      if (result?.needsBusinessName) {
        setPendingGoogleCredential(credential);
      }
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteGoogleSignup(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(pendingGoogleCredential, googleBusinessName);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setLoading(false);
    }
  }

  // Si se llegó directo a "Crear cuenta" desde la landing, nunca se mostró
  // el selector de dueño/empleado — Volver debe salir a la landing. Si en
  // cambio se llegó eligiendo "Soy el dueño" (o su enlace de "Crear
  // cuenta"), Volver regresa al selector.
  function handleOwnerBack() {
    if (initialMode === 'signup') {
      onBack?.();
    } else {
      setAudience(null);
      setMode('login');
      setError('');
    }
  }

  if (initialMode === 'login' && audience === null && !resolvedBusiness) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-950 to-black px-4">
        <motion.form
          onSubmit={handleBusinessLookup}
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
            <IconStore className="h-6 w-6" />
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
          <p className="mb-6 text-center text-xs text-slate-500">¿Cuál es el nombre de tu negocio?</p>

          <motion.div animate={shakeControls}>
            <input
              autoFocus
              type="text"
              required
              value={businessQuery}
              onChange={(e) => setBusinessQuery(e.target.value)}
              placeholder="Nombre de tu negocio"
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

          <button type="submit" disabled={lookingUpBusiness} className="btn-primary mt-4 w-full">
            {lookingUpBusiness ? 'Buscando…' : 'Continuar'}
          </button>
        </motion.form>
      </div>
    );
  }

  if (mode === 'login' && audience === null) {
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
          <button
            type="button"
            onClick={() => {
              setResolvedBusiness(null);
              setError('');
            }}
            className="mb-3 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            ← Volver
          </button>
          <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">{resolvedBusiness?.name}</h1>
          <p className="mb-6 text-center text-xs text-slate-500">¿Quién va a entrar?</p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAudience('owner')}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <IconStore className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">Soy el dueño</span>
                <span className="block text-xs text-slate-400">Panel completo del negocio</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAudience('employee')}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <IconUsers className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">Soy empleado</span>
                <span className="block text-xs text-slate-400">Solo cobrar en Caja</span>
              </span>
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            ¿Vas a crear una cuenta nueva de negocio?{' '}
            <button
              type="button"
              onClick={() => {
                setAudience('owner');
                setMode('signup');
              }}
              className="font-medium text-slate-600 underline"
            >
              Crear cuenta
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  if (audience === 'employee') {
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
            <IconUsers className="h-6 w-6" />
          </motion.div>
          <button
            type="button"
            onClick={() => {
              setAudience(null);
              setEmployeeStep('choice');
              setError('');
            }}
            className="mb-3 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            ← Volver
          </button>
          <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">{resolvedBusiness?.name}</h1>
          <p className="mb-6 text-center text-xs text-slate-500">
            {employeeStep === 'manual' ? 'Ingresa tu usuario y contraseña' : 'Escanea tu código o entra manualmente'}
          </p>

          {employeeStep === 'choice' && (
            <div className="space-y-3">
              {CAMERA_SUPPORTED && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setEmployeeStep('scan');
                  }}
                  className="btn-primary flex w-full items-center justify-center gap-2"
                >
                  <IconCamera className="h-4 w-4" />
                  Escanear código
                </button>
              )}
              <button type="button" onClick={() => setEmployeeStep('manual')} className="btn-secondary w-full">
                Ingresar usuario y contraseña
              </button>
            </div>
          )}

          {employeeStep === 'manual' && (
            <form onSubmit={handleEmployeeSubmit}>
              <motion.div animate={shakeControls} className="space-y-3">
                <input
                  type="text"
                  required
                  autoFocus
                  value={employeeUsername}
                  onChange={(e) => setEmployeeUsername(e.target.value)}
                  placeholder="Usuario"
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
                {loading ? 'Un momento…' : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmployeeStep('choice');
                  setError('');
                }}
                className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
              >
                ← Volver
              </button>
            </form>
          )}

          {employeeStep === 'scan' && (
            <>
              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-3 text-center text-sm text-rose-600"
                >
                  {error}
                </motion.p>
              )}
              <button
                type="button"
                onClick={() => setEmployeeStep('choice')}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            </>
          )}
        </motion.div>

        <Suspense fallback={null}>
          <CameraScannerModal
            open={employeeStep === 'scan'}
            onClose={() => setEmployeeStep('choice')}
            onDetected={handleQrDetected}
          />
        </Suspense>
      </div>
    );
  }

  if (forgotStep) {
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

          {forgotStep === 'sent' ? (
            <>
              <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">Revisa tu correo</h1>
              <p className="mb-6 text-center text-xs text-slate-500">{forgotError}</p>
              <button
                type="button"
                onClick={() => {
                  setForgotStep(null);
                  setForgotEmail('');
                  setForgotError('');
                }}
                className="btn-primary w-full"
              >
                Volver a iniciar sesión
              </button>
            </>
          ) : (
            <form onSubmit={handleForgotSubmit}>
              <button
                type="button"
                onClick={() => {
                  setForgotStep(null);
                  setForgotError('');
                }}
                className="mb-3 text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                ← Volver
              </button>
              <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">Recuperar contraseña</h1>
              <p className="mb-6 text-center text-xs text-slate-500">
                Te mandamos un enlace a tu correo para elegir una nueva.
              </p>
              <input
                autoFocus
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="input"
              />
              {forgotError && <p className="mt-3 text-center text-sm text-rose-600">{forgotError}</p>}
              <button type="submit" disabled={forgotLoading} className="btn-primary mt-4 w-full">
                {forgotLoading ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  if (pendingGoogleCredential) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-950 to-black px-4">
        <motion.form
          onSubmit={handleCompleteGoogleSignup}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur"
        >
          <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">Ya casi</h1>
          <p className="mb-6 text-center text-xs text-slate-500">
            Google confirmó tu correo — ahora dinos el nombre de tu negocio.
          </p>
          <motion.div animate={shakeControls}>
            <input
              autoFocus
              type="text"
              required
              value={googleBusinessName}
              onChange={(e) => setGoogleBusinessName(e.target.value)}
              placeholder="Nombre de tu negocio"
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
            {loading ? 'Un momento…' : 'Crear cuenta'}
          </button>
          <button
            type="button"
            onClick={() => setPendingGoogleCredential(null)}
            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
          >
            Cancelar
          </button>
        </motion.form>
      </div>
    );
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
        <button
          type="button"
          onClick={handleOwnerBack}
          className="mb-3 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          ← Volver
        </button>
        <h1 className="mb-1 text-center text-xl font-semibold text-slate-800">
          {mode === 'login' ? resolvedBusiness?.name : 'Mostrador'}
        </h1>
        <p className="mb-6 text-center text-xs text-slate-500">
          {mode === 'login' ? 'Ingresa a tu panel' : 'Crea la cuenta de tu negocio'}
        </p>

        <div className="mb-5">
          <GoogleSignInButton onCredential={handleGoogleCredential} />
        </div>

        <div className="mb-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          o con tu correo
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <motion.div animate={shakeControls} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Nombre de tu negocio"
              className="input"
            />
          )}
          <input
            type="email"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
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

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => {
              setForgotEmail(identifier.includes('@') ? identifier : '');
              setForgotStep('form');
              setError('');
            }}
            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {mode === 'signup' && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Después de crear la cuenta te pedimos activar la suscripción mensual.
          </p>
        )}
      </motion.form>
    </div>
  );
}
