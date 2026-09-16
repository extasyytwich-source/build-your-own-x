import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal.jsx';
import { useShake } from '../hooks/useShake.js';
import { IconX } from './icons.jsx';
import { api } from '../api.js';

const EMPTY_ITEM = { productId: '', quantity: '', unitCost: '' };

export default function PurchaseOrderFormModal({ open, onClose, onSubmit, suppliers, products }) {
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shakeControls, shake] = useShake();

  useEffect(() => {
    if (open) {
      setSupplierId(suppliers[0]?.id ? String(suppliers[0].id) : '');
      setNotes('');
      setItems([{ ...EMPTY_ITEM }]);
      setError('');
    }
  }, [open, suppliers]);

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function productDefaultCost(productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    return product ? product.cost : '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        supplierId: Number(supplierId),
        notes,
        items: items
          .filter((i) => i.productId)
          .map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
      });
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setSaving(false);
    }
  }

  const total = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

  return (
    <Modal open={open} onClose={onClose} title="Nueva orden de compra" width="max-w-xl">
      <motion.form animate={shakeControls} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Proveedor*</label>
          <select required className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="" disabled>
              Selecciona un proveedor
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Productos</label>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  required
                  className="input flex-1"
                  value={item.productId}
                  onChange={(e) => {
                    updateItem(index, 'productId', e.target.value);
                    if (!item.unitCost) updateItem(index, 'unitCost', productDefaultCost(e.target.value));
                  }}
                >
                  <option value="" disabled>
                    Producto…
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Cant."
                  className="input w-20"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                />
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Costo c/u"
                  className="input w-28"
                  value={item.unitCost}
                  onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="text-slate-300 hover:text-rose-500 disabled:opacity-30"
                  aria-label="Quitar línea"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="btn-secondary mt-2 text-xs">
            + Agregar línea
          </button>
        </div>

        <div>
          <label className="label">Notas (opcional)</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <p className="text-right text-sm font-semibold text-slate-700">
          Total estimado: {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
        </p>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving || suppliers.length === 0} className="btn-primary">
            {saving ? 'Creando…' : 'Crear orden'}
          </button>
        </div>
      </motion.form>
    </Modal>
  );
}
