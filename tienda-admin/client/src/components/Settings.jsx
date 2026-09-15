import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Settings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const [aiStatus, setAiStatus] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const { notify } = useToast();

  useEffect(() => {
    api.getAiSettings().then(setAiStatus).catch(() => {});
  }, []);

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

  async function handleSaveApiKey(e) {
    e.preventDefault();
    setSavingKey(true);
    try {
      await api.saveAiApiKey(apiKeyInput);
      notify('API key guardada');
      setApiKeyInput('');
      setAiStatus(await api.getAiSettings());
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingKey(false);
    }
  }

  async function handleRemoveApiKey() {
    try {
      await api.deleteAiApiKey();
      notify('API key eliminada');
      setAiStatus(await api.getAiSettings());
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Ajustes</h1>

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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card mt-6 max-w-sm p-6"
      >
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Análisis con IA</h2>
        <p className="mb-4 text-xs text-slate-500">API key de Anthropic para Reportes.</p>

        {aiStatus?.configured && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <span>
              Configurada{aiStatus.source === 'env' ? ' (desde .env)' : ''}: {aiStatus.maskedKey}
            </span>
            {aiStatus.source !== 'env' && (
              <button onClick={handleRemoveApiKey} className="font-medium underline">
                Quitar
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSaveApiKey} className="flex gap-2">
          <input
            type="password"
            className="input"
            placeholder="sk-ant-..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button type="submit" disabled={savingKey || !apiKeyInput} className="btn-secondary">
            {savingKey ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
