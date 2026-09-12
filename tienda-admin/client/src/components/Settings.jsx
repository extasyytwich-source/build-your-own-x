import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Settings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPin !== confirmPin) {
      notify('El nuevo PIN y la confirmación no coinciden', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.changePin(currentPin, newPin);
      notify('PIN actualizado correctamente');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Ajustes</h1>
      <p className="mb-6 text-sm text-slate-500">
        Este panel es privado. Cambia el PIN de acceso cuando lo necesites.
      </p>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="card max-w-sm space-y-4 p-6"
      >
        <div>
          <label className="label">PIN actual</label>
          <input
            required
            type="password"
            className="input"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Nuevo PIN</label>
          <input
            required
            type="password"
            minLength={4}
            className="input"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Confirmar nuevo PIN</label>
          <input
            required
            type="password"
            minLength={4}
            className="input"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Guardando…' : 'Actualizar PIN'}
        </button>
      </motion.form>
    </div>
  );
}
