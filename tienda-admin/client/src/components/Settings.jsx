import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Modal from './Modal.jsx';
import {
  IconDownload,
  IconUpload,
  IconFileText,
  IconSmartphone,
  IconUsers,
  IconX,
  IconSend,
  IconCheckCircle,
  IconQrCode,
} from './icons.jsx';

const SUBSCRIPTION_LABELS = {
  activa: 'Activa',
  pendiente_pago: 'Pendiente de pago',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

export default function Settings() {
  const { subscriptionStatus, refreshSubscriptionStatus } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [billing, setBilling] = useState(null);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [aiStatus, setAiStatus] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [exportingKind, setExportingKind] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);

  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [hasPassword, setHasPassword] = useState(true);
  const { notify } = useToast();

  const [employees, setEmployees] = useState([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeUsername, setNewEmployeeUsername] = useState('');
  const [newEmployeePassword, setNewEmployeePassword] = useState('');
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [deleteEmployeeTarget, setDeleteEmployeeTarget] = useState(null);
  const [removingEmployee, setRemovingEmployee] = useState(false);
  const [qrEmployee, setQrEmployee] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  const [telegramStatus, setTelegramStatus] = useState(null);
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramQr, setTelegramQr] = useState(null);
  const [disconnectingTelegram, setDisconnectingTelegram] = useState(false);
  const pollRef = useRef(null);

  const panelUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function loadEmployees() {
    api.getEmployees().then(setEmployees).catch(() => {});
  }

  function loadTelegramStatus() {
    return api.getTelegramStatus().then(setTelegramStatus).catch(() => {});
  }

  useEffect(() => {
    api.getAiSettings().then(setAiStatus).catch(() => {});
    api.getBillingStatus().then(setBilling).catch(() => {});
    api.getMe().then((me) => setHasPassword(me.hasPassword)).catch(() => {});
    loadEmployees();
    loadTelegramStatus();
    return () => clearInterval(pollRef.current);
  }, []);

  async function handleConnectTelegram() {
    setTelegramConnecting(true);
    try {
      const { url } = await api.connectTelegram();
      setTelegramLink(url);
      setTelegramQr(await QRCode.toDataURL(url, { margin: 1, width: 168 }));
      // El vínculo se confirma del lado de Telegram (cuando tocan "Iniciar"
      // en el chat), no en esta pestaña — se pregunta cada tanto si ya
      // llegó, en vez de pedirle a la persona que actualice a mano.
      clearInterval(pollRef.current);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        const status = await api.getTelegramStatus().catch(() => null);
        if (status?.connected) {
          clearInterval(pollRef.current);
          setTelegramStatus(status);
          setTelegramLink(null);
          setTelegramQr(null);
          notify('Telegram conectado');
        } else if (attempts >= 40) {
          clearInterval(pollRef.current);
        }
      }, 3000);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setTelegramConnecting(false);
    }
  }

  async function handleDisconnectTelegram() {
    setDisconnectingTelegram(true);
    try {
      await api.disconnectTelegram();
      notify('Telegram desconectado');
      await loadTelegramStatus();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDisconnectingTelegram(false);
    }
  }

  async function handleCreateEmployee(e) {
    e.preventDefault();
    setCreatingEmployee(true);
    try {
      await api.createEmployee({
        name: newEmployeeName,
        username: newEmployeeUsername,
        password: newEmployeePassword,
      });
      notify('Empleado agregado');
      setNewEmployeeName('');
      setNewEmployeeUsername('');
      setNewEmployeePassword('');
      loadEmployees();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setCreatingEmployee(false);
    }
  }

  async function handleRemoveEmployee() {
    setRemovingEmployee(true);
    try {
      await api.deleteEmployee(deleteEmployeeTarget.id);
      notify('Empleado eliminado');
      loadEmployees();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setRemovingEmployee(false);
      setDeleteEmployeeTarget(null);
    }
  }

  // Genera (o regenera, invalidando el anterior) el código QR de acceso
  // rápido del empleado: quien lo escanee entra directo como él, sin
  // usuario ni contraseña — ver LoginGate.jsx del lado de quien entra.
  async function handleShowQr(emp) {
    setQrEmployee(emp);
    setGeneratingQr(true);
    try {
      const { token } = await api.generateEmployeeQr(emp.id);
      setQrImage(await QRCode.toDataURL(token, { margin: 1, width: 220 }));
    } catch (err) {
      notify(err.message, 'error');
      setQrEmployee(null);
    } finally {
      setGeneratingQr(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(panelUrl, { margin: 1, width: 168 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [panelUrl]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notify('La nueva contraseña y la confirmación no coinciden', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(hasPassword ? currentPassword : undefined, newPassword);
      notify(hasPassword ? 'Contraseña actualizada correctamente' : 'Contraseña creada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setHasPassword(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSubscription() {
    setCancelingSubscription(true);
    try {
      await api.cancelSubscription();
      notify('Suscripción cancelada');
      setBilling(await api.getBillingStatus());
      await refreshSubscriptionStatus();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setCancelingSubscription(false);
      setConfirmCancel(false);
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
      await api.restoreBackup(restoreFile);
      notify('Respaldo restaurado correctamente');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setRestoring(false);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Ajustes</h1>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card max-w-sm p-6"
      >
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Suscripción</h2>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">
            Estado: <strong>{SUBSCRIPTION_LABELS[billing?.subscriptionStatus] ?? '—'}</strong>
          </span>
          <span className="font-medium text-slate-800">$20.000/mes</span>
        </div>
        {billing?.subscriptionVence && (
          <p className="mb-4 text-xs text-slate-500">
            Vence: {new Date(billing.subscriptionVence).toLocaleDateString('es-CL')}
          </p>
        )}
        {billing?.subscriptionStatus === 'activa' && (
          <button
            onClick={() => setConfirmCancel(true)}
            className="text-xs text-rose-600 underline"
          >
            Cancelar suscripción
          </button>
        )}
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onSubmit={handleSubmit}
        className="card mt-6 max-w-sm space-y-4 p-6"
      >
        <h2 className="text-sm font-semibold text-slate-700">
          {hasPassword ? 'Cambiar contraseña' : 'Poner una contraseña'}
        </h2>
        {!hasPassword && (
          <p className="-mt-2 text-xs text-slate-500">
            Tu cuenta entra con Google. Puedes poner una contraseña además, por si algún día
            quieres entrar sin pasar por Google.
          </p>
        )}
        {hasPassword && (
          <div>
            <label className="label">Contraseña actual</label>
            <input
              required
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label">Nueva contraseña</label>
          <input
            required
            type="password"
            minLength={8}
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Confirmar nueva contraseña</label>
          <input
            required
            type="password"
            minLength={8}
            className="input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card mt-6 max-w-sm p-6"
      >
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <IconUsers className="h-4 w-4" />
          Empleados
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Cada empleado entra con su propio usuario y contraseña, o escaneando su código QR
          (ícono junto a su nombre), directo a la pantalla de Caja — no ve productos, historial,
          reportes ni ajustes.
        </p>

        {employees.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {employees.map((emp) => (
              <li
                key={emp.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-slate-700">{emp.name}</span>
                  <span className="ml-2 text-xs text-slate-400">@{emp.username}</span>
                </span>
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => handleShowQr(emp)}
                    className="text-slate-300 hover:text-slate-600"
                    aria-label={`Código QR de ${emp.name}`}
                  >
                    <IconQrCode className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteEmployeeTarget(emp)}
                    className="text-slate-300 hover:text-rose-500"
                    aria-label={`Quitar a ${emp.name}`}
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreateEmployee} className="space-y-3">
          <input
            required
            className="input"
            placeholder="Nombre del empleado"
            value={newEmployeeName}
            onChange={(e) => setNewEmployeeName(e.target.value)}
          />
          <input
            required
            className="input"
            placeholder="Usuario (con el que va a entrar)"
            value={newEmployeeUsername}
            onChange={(e) => setNewEmployeeUsername(e.target.value)}
          />
          <input
            required
            type="password"
            minLength={8}
            className="input"
            placeholder="Contraseña"
            value={newEmployeePassword}
            onChange={(e) => setNewEmployeePassword(e.target.value)}
          />
          <button type="submit" disabled={creatingEmployee} className="btn-secondary w-full">
            {creatingEmployee ? 'Agregando…' : 'Agregar empleado'}
          </button>
        </form>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        className="card mt-6 max-w-sm p-6"
      >
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <IconSend className="h-4 w-4" />
          Avisos por Telegram
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Un mensaje directo cada vez que se registra una venta: qué se vendió y cuánto ganaste.
        </p>

        {!telegramStatus?.configured ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">
            Esta función todavía no está configurada en el servidor.
          </p>
        ) : telegramStatus.connected ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <span className="flex items-center gap-1.5">
              <IconCheckCircle className="h-4 w-4" />
              Conectado
            </span>
            <button
              onClick={handleDisconnectTelegram}
              disabled={disconnectingTelegram}
              className="font-medium underline"
            >
              {disconnectingTelegram ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>
        ) : telegramLink ? (
          <div className="flex flex-col items-center gap-3 text-center">
            {telegramQr && (
              <img
                src={telegramQr}
                alt="Código QR para conectar Telegram"
                className="h-36 w-36 rounded-xl border border-slate-200 p-2"
              />
            )}
            <p className="text-xs text-slate-500">
              Escanea el código o{' '}
              <a href={telegramLink} target="_blank" rel="noreferrer" className="font-medium underline">
                abre el chat
              </a>{' '}
              y toca "Iniciar" — esto se actualiza solo en cuanto conectes.
            </p>
          </div>
        ) : (
          <button
            onClick={handleConnectTelegram}
            disabled={telegramConnecting}
            className="btn-secondary w-full"
          >
            {telegramConnecting ? 'Conectando…' : 'Conectar Telegram'}
          </button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
        transition={{ delay: 0.15 }}
        className="card mt-6 max-w-lg p-6"
      >
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Respaldo y exportación</h2>
        <p className="mb-4 text-xs text-slate-500">
          Guarda una copia de tus datos, o expórtalos en CSV para revisarlos en Excel.
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
            accept=".json"
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card mt-6 max-w-lg p-6"
      >
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <IconSmartphone className="h-4 w-4" />
          Usar desde tu teléfono
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Escanea este código con la cámara del teléfono para abrir el panel e iniciar sesión ahí
          también — sirve para usar el escáner de código de barras caminando por la tienda.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="Código QR para abrir el panel en el teléfono"
              className="h-36 w-36 flex-shrink-0 rounded-xl border border-slate-200 p-2"
            />
          )}
          <p className="break-all font-mono text-xs text-slate-600">{panelUrl}</p>
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

      <Modal
        open={Boolean(qrEmployee)}
        onClose={() => setQrEmployee(null)}
        title={`Código de acceso — ${qrEmployee?.name ?? ''}`}
        width="max-w-xs"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          {generatingQr ? (
            <div className="flex h-56 w-56 items-center justify-center text-sm text-slate-400">
              Generando…
            </div>
          ) : (
            qrImage && (
              <img
                src={qrImage}
                alt={`Código QR de acceso de ${qrEmployee?.name}`}
                className="h-56 w-56 rounded-xl border border-slate-200 p-2"
              />
            )
          )}
          <p className="text-xs text-slate-500">
            Este código entra directo como <strong>{qrEmployee?.name}</strong>, sin pedir usuario
            ni contraseña. Muéstralo en pantalla o imprímelo cerca de la caja — trátalo como una
            contraseña.
          </p>
          <p className="text-xs text-slate-400">
            Si se pierde o quieres que deje de funcionar, genera uno nuevo: el anterior queda
            invalidado al instante.
          </p>
          <button
            onClick={() => handleShowQr(qrEmployee)}
            disabled={generatingQr}
            className="btn-secondary w-full"
          >
            {generatingQr ? 'Generando…' : 'Regenerar código'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteEmployeeTarget)}
        onClose={() => setDeleteEmployeeTarget(null)}
        onConfirm={handleRemoveEmployee}
        title="Quitar empleado"
        message={`"${deleteEmployeeTarget?.name}" ya no va a poder iniciar sesión.`}
        confirmLabel={removingEmployee ? 'Quitando…' : 'Quitar'}
      />

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancelSubscription}
        title="Cancelar suscripción"
        message="Se bloqueará el acceso al panel hasta que vuelvas a suscribirte. Tus datos no se borran."
        confirmLabel={cancelingSubscription ? 'Cancelando…' : 'Sí, cancelar'}
      />
    </div>
  );
}
