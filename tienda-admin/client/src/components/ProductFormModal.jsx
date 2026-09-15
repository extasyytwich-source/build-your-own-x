import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal.jsx';
import { useShake } from '../hooks/useShake.js';

const EMPTY = {
  name: '',
  sku: '',
  category: '',
  price: '',
  cost: '',
  stock: '',
  minStock: '',
  unit: 'unidad',
  description: '',
  taxCategory: 'general',
};

// Las tasas son ley (Chile: IVA 19% + impuesto adicional a bebidas según
// DL 825 art. 42) — ver server/src/tax.js. Acá el dueño solo elige la
// categoría del producto, no escribe ningún número.
const TAX_CATEGORIES = [
  { value: 'general', label: 'General (19% IVA)' },
  { value: 'alcohol_mas_20', label: 'Bebida alcohólica >20° (19% + 31,5%)' },
  { value: 'alcohol_hasta_20', label: 'Bebida alcohólica ≤20° (19% + 20,5%)' },
  { value: 'bebida_azucarada', label: 'Bebida azucarada (19% + 18%)' },
  { value: 'exento', label: 'Exento' },
];

export default function ProductFormModal({ open, onClose, onSubmit, product, initialSku = '' }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shakeControls, shake] = useShake();

  useEffect(() => {
    if (open) {
      setForm(
        product
          ? {
              name: product.name,
              sku: product.sku || '',
              category: product.category || '',
              price: product.price,
              cost: product.cost,
              stock: product.stock,
              minStock: product.minStock,
              unit: product.unit,
              description: product.description || '',
              taxCategory: product.taxCategory || 'general',
            }
          : { ...EMPTY, sku: initialSku }
      );
      setError('');
    }
  }, [open, product, initialSku]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Editar producto' : 'Nuevo producto'}
      width="max-w-lg"
    >
      <motion.form
        animate={shakeControls}
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-4"
      >
        <div className="col-span-2">
          <label className="label">Nombre*</label>
          <input
            required
            className="input"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ej. Café en grano 1kg"
          />
        </div>

        <div>
          <label className="label">SKU / código</label>
          <input
            className="input"
            value={form.sku}
            onChange={(e) => update('sku', e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className="label">Categoría</label>
          <input
            className="input"
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            placeholder="Ej. Bebidas"
          />
        </div>

        <div className="col-span-2">
          <label className="label">Categoría de impuesto</label>
          <select
            className="input"
            value={form.taxCategory}
            onChange={(e) => update('taxCategory', e.target.value)}
          >
            {TAX_CATEGORIES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Precio de venta</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Costo</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={form.cost}
            onChange={(e) => update('cost', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Stock inicial</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={form.stock}
            onChange={(e) => update('stock', e.target.value)}
            disabled={Boolean(product)}
          />
          {product && (
            <p className="mt-1 text-xs text-slate-400">
              Usa "Registrar movimiento" para ajustar el stock.
            </p>
          )}
        </div>

        <div>
          <label className="label">Stock mínimo</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={form.minStock}
            onChange={(e) => update('minStock', e.target.value)}
          />
        </div>

        <div className="col-span-2">
          <label className="label">Unidad</label>
          <input
            className="input"
            value={form.unit}
            onChange={(e) => update('unit', e.target.value)}
            placeholder="unidad, kg, caja, litro…"
          />
        </div>

        <div className="col-span-2">
          <label className="label">Descripción</label>
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>

        {error && <p className="col-span-2 text-sm text-rose-600">{error}</p>}

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </motion.form>
    </Modal>
  );
}
