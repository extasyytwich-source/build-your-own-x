import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { IconPlusCircle, IconMinusCircle, IconWrench, IconReceipt } from './icons.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import EmptyState from './EmptyState.jsx';

const TYPE_STYLES = {
  entrada: { label: 'Entrada', className: 'bg-emerald-50 text-emerald-700', Icon: IconPlusCircle },
  salida: { label: 'Salida', className: 'bg-rose-50 text-rose-700', Icon: IconMinusCircle },
  ajuste: { label: 'Ajuste', className: 'bg-slate-100 text-slate-600', Icon: IconWrench },
};

export default function MovementHistory() {
  const [movements, setMovements] = useState([]);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const { handleUnauthorized } = useAuth();
  const { notify } = useToast();

  useEffect(() => {
    setLoading(true);
    const params = { limit: 100 };
    if (type) params.type = type;
    api
      .getMovements(params)
      .then(setMovements)
      .catch((err) => {
        if (err.status === 401) return handleUnauthorized();
        notify(err.message, 'error');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold text-slate-800">Historial de movimientos</h1>
        <select className="input sm:max-w-[220px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="ajuste">Ajustes</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Stock resultante</th>
                <th className="px-4 py-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {movements.map((m) => {
                  const style = TYPE_STYLES[m.type];
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {new Date(m.createdAt.replace(' ', 'T') + 'Z').toLocaleString('es')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{m.productName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}
                        >
                          <style.Icon className="h-3.5 w-3.5" />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{m.quantity}</td>
                      <td className="px-4 py-3 text-slate-700">{m.stockAfter}</td>
                      <td className="px-4 py-3 text-slate-500">{m.note || '—'}</td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {loading && <LoadingSpinner label="Cargando historial…" />}
        {!loading && movements.length === 0 && (
          <EmptyState icon={IconReceipt} title="Todavía no hay movimientos registrados" />
        )}
      </div>
    </div>
  );
}
