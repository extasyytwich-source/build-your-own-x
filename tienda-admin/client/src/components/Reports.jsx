import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StatCard from './StatCard.jsx';

const currency = (n) =>
  Number(n || 0).toLocaleString('es', { style: 'currency', currency: 'USD' });

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState(null);
  const [cashEntries, setCashEntries] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const [cashForm, setCashForm] = useState({
    type: 'ingreso',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [savingCash, setSavingCash] = useState(false);

  const { handleUnauthorized } = useAuth();
  const { notify } = useToast();

  async function loadAll() {
    setLoading(true);
    try {
      const [reportData, cashData, analysisData] = await Promise.all([
        api.getMonthlyReport(month),
        api.getCashEntries(month),
        api.getMonthlyAnalysis(month),
      ]);
      setReport(reportData);
      setCashEntries(cashData);
      setAnalysis(analysisData);
      setAiError('');
    } catch (err) {
      if (err.status === 401) return handleUnauthorized();
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleGenerateAnalysis() {
    setGenerating(true);
    setAiError('');
    try {
      const data = await api.generateMonthlyAnalysis(month);
      setAnalysis(data);
      notify('Análisis generado');
    } catch (err) {
      if (err.status === 401 && err.message.includes('Sesión')) return handleUnauthorized();
      setAiError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddCashEntry(e) {
    e.preventDefault();
    setSavingCash(true);
    try {
      await api.createCashEntry({
        ...cashForm,
        amount: Number(cashForm.amount),
      });
      notify(cashForm.type === 'ingreso' ? 'Ingreso registrado' : 'Faltante registrado');
      setCashForm((f) => ({ ...f, amount: '', note: '' }));
      loadAll();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingCash(false);
    }
  }

  async function handleDeleteCashEntry(id) {
    try {
      await api.deleteCashEntry(id);
      notify('Registro eliminado');
      loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Reportes mensuales</h1>
          <p className="text-sm text-slate-500">
            Ganancias, reposición, alertas críticas y control de caja del mes.
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input sm:max-w-[180px]"
        />
      </div>

      {loading || !report ? (
        <div className="py-16 text-center text-slate-400">Cargando reporte…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon="💵"
              label="Ganancias del mes"
              value={report.profit}
              formatter={currency}
              accent="emerald"
            />
            <StatCard
              icon="🧾"
              label="Ventas calculadas"
              value={report.revenue}
              formatter={currency}
              accent="brand"
              delay={0.05}
            />
            <StatCard
              icon="📥"
              label="Gasto en reposición"
              value={report.restockCost}
              formatter={currency}
              accent="amber"
              delay={0.1}
            />
            <StatCard
              icon={report.cash.difference < 0 ? '⚠️' : '✅'}
              label="Diferencia de caja"
              value={report.cash.difference}
              formatter={currency}
              accent={report.cash.difference < 0 ? 'rose' : 'emerald'}
              delay={0.15}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5"
            >
              <h2 className="mb-4 text-sm font-semibold text-slate-700">📦 A reponer ahora</h2>
              {report.restockNeeded.length === 0 ? (
                <p className="text-sm text-slate-400">Ningún producto necesita reposición.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.restockNeeded.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium text-slate-700">{p.name}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        {p.stock} / {p.minStock} {p.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="card p-5"
            >
              <h2 className="mb-4 text-sm font-semibold text-slate-700">
                🚨 Alertas críticas
              </h2>
              {report.criticalItems.length === 0 ? (
                <p className="text-sm text-slate-400">No hay productos en estado crítico.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.criticalItems.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium text-slate-700">{p.name}</span>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        {p.stock <= 0 ? 'Sin stock' : `${p.stock} ${p.unit}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card mt-6 p-5"
          >
            <h2 className="mb-1 text-sm font-semibold text-slate-700">💰 Control de caja</h2>
            <p className="mb-4 text-xs text-slate-400">
              Registra el dinero que realmente ingresó y lo que haga falta, para contrastarlo
              contra las ventas calculadas por el sistema ({currency(report.cash.expectedRevenue)}
              ).
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form onSubmit={handleAddCashEntry} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashForm((f) => ({ ...f, type: 'ingreso' }))}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      cashForm.type === 'ingreso'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ➕ Dinero que ingresó
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashForm((f) => ({ ...f, type: 'faltante' }))}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      cashForm.type === 'faltante'
                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ➖ Dinero que falta
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Monto"
                    className="input"
                    value={cashForm.amount}
                    onChange={(e) => setCashForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                  <input
                    required
                    type="date"
                    className="input"
                    value={cashForm.date}
                    onChange={(e) => setCashForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <input
                  className="input"
                  placeholder="Nota (opcional)"
                  value={cashForm.note}
                  onChange={(e) => setCashForm((f) => ({ ...f, note: e.target.value }))}
                />
                <button type="submit" disabled={savingCash} className="btn-primary w-full">
                  {savingCash ? 'Guardando…' : 'Registrar'}
                </button>

                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>Ingresado: {currency(report.cash.registeredIncome)}</span>
                  <span>Faltante: {currency(report.cash.missingAmount)}</span>
                </div>
              </form>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100">
                {cashEntries.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400">
                    No hay registros de caja este mes.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {cashEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div>
                          <span
                            className={
                              entry.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'
                            }
                          >
                            {entry.type === 'ingreso' ? '➕' : '➖'} {currency(entry.amount)}
                          </span>
                          <div className="text-xs text-slate-400">
                            {entry.date} {entry.note ? `· ${entry.note}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCashEntry(entry.id)}
                          className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card mt-6 p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">✨ Análisis con IA</h2>
              <button
                onClick={handleGenerateAnalysis}
                disabled={generating}
                className="btn-secondary"
              >
                {generating
                  ? 'Analizando…'
                  : analysis?.analysis
                    ? 'Actualizar análisis'
                    : 'Generar análisis'}
              </button>
            </div>

            {aiError && (
              <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                {aiError}
              </div>
            )}

            {generating ? (
              <div className="py-6 text-center text-sm text-slate-400">
                Analizando los datos del mes…
              </div>
            ) : analysis?.analysis ? (
              <div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {analysis.analysis}
                </p>
                {analysis.generatedAt && (
                  <p className="mt-3 text-xs text-slate-400">
                    Generado el {new Date(analysis.generatedAt.replace(' ', 'T') + 'Z').toLocaleString('es')}
                  </p>
                )}
              </div>
            ) : (
              !aiError && (
                <p className="text-sm text-slate-400">
                  Todavía no hay un análisis generado para este mes.
                </p>
              )
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
