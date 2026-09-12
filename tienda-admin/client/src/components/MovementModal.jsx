import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';

const TYPES = [
  { value: 'salida', label: 'Salida (uso / venta)', icon: '➖' },
  { value: 'entrada', label: 'Entrada (compra / reposición)', icon: '➕' },
  { value: 'ajuste', label: 'Ajuste manual de stock', icon: '🛠️' },
];

export default function MovementModal({ open, onClose, onSubmit, product }) {
  const [type, setType] = useState('salida');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setType('salida');
      setQuantity('');
      setNote('');
      setError('');
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({ productId: product.id, type, quantity: Number(quantity), note });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Registrar movimiento — ${product.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Tipo de movimiento</label>
          <div className="grid grid-cols-1 gap-2">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setType(t.value)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                  type === t.value
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">
            {type === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
          </label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            Stock actual: {product.stock} {product.unit}
          </p>
        </div>

        <div>
          <label className="label">Nota (opcional)</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej. Venta mostrador, uso en receta, conteo físico…"
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving || quantity === ''} className="btn-primary">
            {saving ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
