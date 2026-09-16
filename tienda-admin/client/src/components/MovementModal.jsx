import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal.jsx';
import SelectableOption from './SelectableOption.jsx';
import { useShake } from '../hooks/useShake.js';
import { api } from '../api.js';
import { IconMinusCircle, IconPlusCircle, IconWrench } from './icons.jsx';

const TYPES = [
  { value: 'salida', label: 'Salida', Icon: IconMinusCircle },
  { value: 'entrada', label: 'Entrada', Icon: IconPlusCircle },
  { value: 'ajuste', label: 'Ajuste de stock', Icon: IconWrench },
];

export default function MovementModal({ open, onClose, onSubmit, product }) {
  const [type, setType] = useState('salida');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shakeControls, shake] = useShake();
  const [locationStocks, setLocationStocks] = useState([]);
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    if (open) {
      setType('salida');
      setQuantity('');
      setNote('');
      setError('');
      setLocationStocks([]);
      setLocationId('');
    }
  }, [open]);

  useEffect(() => {
    if (open && product) {
      api
        .getProductStock(product.id)
        .then((rows) => {
          setLocationStocks(rows);
          if (rows.length > 0) setLocationId(String(rows[0].locationId));
        })
        .catch(() => {});
    }
  }, [open, product]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        productId: product.id,
        type,
        quantity: Number(quantity),
        note,
        locationId: locationId ? Number(locationId) : undefined,
      });
    } catch (err) {
      setError(err.message);
      shake();
    } finally {
      setSaving(false);
    }
  }

  if (!product) return null;

  const currentLocationStock = locationStocks.find((l) => String(l.locationId) === locationId);

  return (
    <Modal open={open} onClose={onClose} title={`Registrar movimiento — ${product.name}`}>
      <motion.form animate={shakeControls} onSubmit={handleSubmit} className="space-y-4">
        {locationStocks.length > 1 && (
          <div>
            <label className="label">Sucursal</label>
            <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locationStocks.map((l) => (
                <option key={l.locationId} value={l.locationId}>
                  {l.locationName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Tipo de movimiento</label>
          <div className="flex flex-col gap-2">
            {TYPES.map((t) => (
              <SelectableOption
                key={t.value}
                selected={type === t.value}
                onClick={() => setType(t.value)}
                layoutId="movement-type-highlight"
              >
                <t.Icon className="h-4 w-4" />
                {t.label}
              </SelectableOption>
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
            Stock actual{locationStocks.length > 1 ? ' en esta sucursal' : ''}:{' '}
            {currentLocationStock ? currentLocationStock.stock : product.stock} {product.unit}
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
      </motion.form>
    </Modal>
  );
}
