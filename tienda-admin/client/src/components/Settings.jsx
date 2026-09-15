import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { IconDownload, IconUpload, IconFileText } from './icons.jsx';

export default function Settings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const [aiStatus, setAiStatus] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [exportingKind, setExportingKind] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreReady, setRestoreReady] = useState(null); // { canAutoRestart }
  const [restarting, setRestarting] = useState(false);
  const fileInputRef = useRef(null);

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

  async function handleDownloadBackup() {
    setDownloadingBackup(true);
    try {
      await api.downloadBackup();
      notify('Respaldo descargado');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDownloadingBackup(false);
    }
  }

  async function handleExport(kind) {
    setExportingKind(kind);
    try {
      if (kind === 'products') await api.exportProductsCsv();
      else if (kind === 'movements') await api.exportMovementsCsv();
      else await api.exportCashCsv();
      notify('Exportado como CSV');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setExportingKind(null);
    }
  }

  function handlePickRestoreFile(e) {
    const file = e.target.files?.[0];
    if (file) setRestoreFile(file);
  }

  async function confirmRestore() {
    setRestoring(true);
    try {
      const result = await api.restoreBackup(restoreFile);
      setRestoreReady({ canAutoRestart: result.canAutoRestart });
      notify('Respaldo cargado');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setRestoring(false);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRestoreReadyConfirm() {
    if (!restoreReady?.canAutoRestart) {
      setRestoreReady(null);
      return;
    }
    setRestarting(true);
    try {
      await api.restartApp();
    } catch (err) {
      notify(err.message, 'error');
      setRestarting(false);
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card mt-6 max-w-lg p-6"
      >
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Respaldo y exportación</h2>
        <p className="mb-4 text-xs text-slate-500">
          Guarda una copia completa de los datos, o expórtalos en CSV para revisarlos en Excel.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            className="btn-secondary"
          >
            <IconDownload className="h-4 w-4" />
            {downloadingBackup ? 'Descargando…' : 'Descargar respaldo'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
          >
            <IconUpload className="h-4 w-4" />
            Restaurar respaldo
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db"
            className="hidden"
            onChange={handlePickRestoreFile}
          />
        </div>

        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Exportar a CSV
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['products', 'Productos'],
            ['movements', 'Movimientos'],
            ['cash', 'Caja'],
          ].map(([kind, label]) => (
            <motion.button
              key={kind}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleExport(kind)}
              disabled={exportingKind === kind}
              className="btn-secondary"
            >
              <IconFileText className="h-4 w-4" />
              {exportingKind === kind ? 'Exportando…' : label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <ConfirmDialog
        open={Boolean(restoreFile)}
        onClose={() => {
          setRestoreFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        onConfirm={confirmRestore}
        title="Restaurar respaldo"
        message={`Esto reemplazará todos los productos, movimientos y registros de caja actuales por los del archivo "${restoreFile?.name}". Esta acción no se puede deshacer. ¿Continuar?`}
        confirmLabel={restoring ? 'Restaurando…' : 'Restaurar'}
      />

      <ConfirmDialog
        open={Boolean(restoreReady)}
        onClose={() => setRestoreReady(null)}
        onConfirm={handleRestoreReadyConfirm}
        title="Respaldo listo"
        message={
          restoreReady?.canAutoRestart
            ? 'El respaldo se cargó correctamente. Se aplicará al reiniciar el programa.'
            : 'El respaldo se cargó correctamente. Cierra y vuelve a abrir el programa para aplicarlo.'
        }
        confirmLabel={
          restarting ? 'Reiniciando…' : restoreReady?.canAutoRestart ? 'Reiniciar ahora' : 'Entendido'
        }
        tone="primary"
      />
    </div>
  );
}
