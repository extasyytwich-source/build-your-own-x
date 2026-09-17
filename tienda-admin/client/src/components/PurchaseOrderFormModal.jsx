import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal.jsx';
import ProductFormModal from './ProductFormModal.jsx';
import { useShake } from '../hooks/useShake.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconCamera, IconX } from './icons.jsx';
import { api } from '../api.js';

// La librería de decodificación (ZXing) pesa bastante: se carga solo cuando
// alguien realmente abre el escáner de cámara, no en cada visita a Compras.
const CameraScannerModal = lazy(() => import('./CameraScannerModal.jsx'));

const CAMERA_SUPPORTED = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

const EMPTY_ITEM = {
  code: '',
  resolvedCode: '',
  productId: '',
  quantity: '',
  unitCost: '',
  lookupError: '',
  loading: false,
};

export default function PurchaseOrderFormModal({
  open,
  onClose,
  onSubmit,
  suppliers,
  products,
  locations = [],
  onProductCreated,
}) {
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shakeControls, shake] = useShake();
  const [locationId, setLocationId] = useState('');

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateSku, setQuickCreateSku] = useState('');
  const [pendingCodeIndex, setPendingCodeIndex] = useState(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTargetIndex, setCameraTargetIndex] = useState(null);

  const { handleUnauthorized } = useAuth();
  const requestTokenRef = useRef({});
  const shouldFocusNewLineRef = useRef(false);
  const codeInputRefs = useRef([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    // Solo se reinicia el formulario al ABRIR el modal, no en cada
    // re-render mientras sigue abierto: crear un producto sobre la marcha
    // (alta rápida) dispara un evento en vivo que recarga products/
    // suppliers/locations en Purchases.jsx, y si este efecto reaccionara a
    // esos props también, borraría todo lo que se llevaba escrito.
    if (open && !wasOpenRef.current) {
      setSupplierId(suppliers[0]?.id ? String(suppliers[0].id) : '');
      setNotes('');
      setItems([{ ...EMPTY_ITEM }]);
      setError('');
      const defaultLocation = locations.find((l) => l.isDefault) || locations[0];
      setLocationId(defaultLocation ? String(defaultLocation.id) : '');
      requestTokenRef.current = {};
      codeInputRefs.current = [];
      setQuickCreateOpen(false);
      setQuickCreateSku('');
      setPendingCodeIndex(null);
    }
    wasOpenRef.current = open;
  }, [open, suppliers, locations]);

  useEffect(() => {
    if (shouldFocusNewLineRef.current) {
      shouldFocusNewLineRef.current = false;
      codeInputRefs.current[items.length - 1]?.focus();
    }
  }, [items.length]);

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

  async function resolveCode(index, rawCode) {
    const code = (rawCode || '').trim();
    if (!code) return;
    const current = items[index];
    if (!current) return;
    // Ya se resolvió con este mismo código (ej. el blur que sigue a un Enter):
    // no hay nada nuevo que buscar.
    if (current.productId && current.resolvedCode === code) return;

    const token = (requestTokenRef.current[index] || 0) + 1;
    requestTokenRef.current[index] = token;
    updateItem(index, 'loading', true);
    updateItem(index, 'lookupError', '');

    try {
      const product = await api.lookupProductByCode(code);
      if (requestTokenRef.current[index] !== token) return; // respuesta obsoleta
      setItems((prev) => {
        const updated = prev.map((item, i) =>
          i === index
            ? {
                ...item,
                code,
                resolvedCode: code,
                productId: String(product.id),
                unitCost: item.unitCost || (product.cost ?? ''),
                loading: false,
                lookupError: '',
              }
            : item
        );
        // Solo se agrega una línea nueva cuando se resuelve la línea activa
        // (la última): editar una línea del medio no debe ir sumando más.
        if (index === prev.length - 1) {
          shouldFocusNewLineRef.current = true;
          return [...updated, { ...EMPTY_ITEM }];
        }
        return updated;
      });
    } catch (err) {
      if (requestTokenRef.current[index] !== token) return;
      updateItem(index, 'loading', false);
      if (err.status === 401) return handleUnauthorized();
      if (err.status === 404) {
        setPendingCodeIndex(index);
        setQuickCreateSku(code);
        setQuickCreateOpen(true);
        return;
      }
      updateItem(index, 'lookupError', err.message || 'No se pudo buscar el código');
    }
  }

  function handleCodeKeyDown(index, e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    resolveCode(index, items[index].code);
  }

  function handleCodeBlur(index) {
    resolveCode(index, items[index].code);
  }

  function openCamera(index) {
    setCameraTargetIndex(index);
    setCameraOpen(true);
  }

  function handleCameraDetected(code) {
    setCameraOpen(false);
    if (cameraTargetIndex != null) resolveCode(cameraTargetIndex, code);
  }

  async function handleQuickCreateProduct(form) {
    const product = await api.createProduct(form);
    onProductCreated?.(product);
    const index = pendingCodeIndex;
    if (index != null) {
      setItems((prev) => {
        const updated = prev.map((item, i) =>
          i === index
            ? {
                ...item,
                code: product.sku || quickCreateSku,
                resolvedCode: product.sku || quickCreateSku,
                productId: String(product.id),
                unitCost: item.unitCost || (product.cost ?? ''),
                lookupError: '',
              }
            : item
        );
        if (index === prev.length - 1) {
          shouldFocusNewLineRef.current = true;
          return [...updated, { ...EMPTY_ITEM }];
        }
        return updated;
      });
    }
    setQuickCreateOpen(false);
    setQuickCreateSku('');
    setPendingCodeIndex(null);
  }

  function handleQuickCreateClose() {
    const index = pendingCodeIndex;
    setQuickCreateOpen(false);
    setQuickCreateSku('');
    setPendingCodeIndex(null);
    if (index != null) updateItem(index, 'lookupError', 'Código no encontrado — corrígelo o crea el producto de nuevo');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const resolvedItems = items.filter((i) => i.productId);
    if (resolvedItems.length === 0) {
      setError('Agrega al menos un producto: escribe o escanea su código, o elígelo de la lista.');
      shake();
      return;
    }
    if (resolvedItems.some((i) => !(Number(i.quantity) > 0) || i.unitCost === '' || Number(i.unitCost) < 0)) {
      setError('Completa la cantidad y el costo de cada producto agregado.');
      shake();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        supplierId: Number(supplierId),
        notes,
        locationId: locationId ? Number(locationId) : undefined,
        items: resolvedItems.map((i) => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
        })),
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
    <>
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

          {locations.length > 1 && (
            <div>
              <label className="label">Recibir en</label>
              <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Productos</label>
            <p className="mb-2 text-xs text-slate-400">
              Escribe o escanea el código de cada producto de la factura. Si no existe todavía, se puede crear al
              instante sin salir de esta pantalla.
            </p>
            <div className="space-y-3">
              {items.map((item, index) => {
                const matchedProduct = item.productId
                  ? products.find((p) => String(p.id) === item.productId)
                  : null;
                return (
                  <div key={index} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="input flex-1"
                        placeholder="Código del producto (escribe o escanea)…"
                        value={item.code}
                        disabled={item.loading}
                        onChange={(e) => updateItem(index, 'code', e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onBlur={() => handleCodeBlur(index)}
                        ref={(el) => {
                          codeInputRefs.current[index] = el;
                        }}
                      />
                      {CAMERA_SUPPORTED && (
                        <button
                          type="button"
                          onClick={() => openCamera(index)}
                          className="btn-secondary px-2"
                          aria-label="Escanear con cámara"
                        >
                          <IconCamera className="h-4 w-4" />
                        </button>
                      )}
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

                    {item.loading && <p className="mt-1 text-xs text-slate-400">Buscando…</p>}
                    {item.lookupError && <p className="mt-1 text-xs text-rose-600">{item.lookupError}</p>}
                    {matchedProduct && !item.lookupError && !item.loading && (
                      <p className="mt-1 text-xs text-emerald-600">✓ {matchedProduct.name}</p>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="input flex-1 text-xs"
                        value={item.productId}
                        onChange={(e) => {
                          updateItem(index, 'productId', e.target.value);
                          if (!item.unitCost) updateItem(index, 'unitCost', productDefaultCost(e.target.value));
                        }}
                      >
                        <option value="">o elige de la lista…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Cant."
                        className="input w-20"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Costo c/u"
                        className="input w-28"
                        value={item.unitCost}
                        onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
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

      <ProductFormModal
        open={quickCreateOpen}
        onClose={handleQuickCreateClose}
        onSubmit={handleQuickCreateProduct}
        product={null}
        initialSku={quickCreateSku}
      />

      {cameraOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white"
              />
              <span className="text-sm text-white/60">Preparando la cámara…</span>
            </div>
          }
        >
          <CameraScannerModal open={cameraOpen} onClose={() => setCameraOpen(false)} onDetected={handleCameraDetected} />
        </Suspense>
      )}
    </>
  );
}
