import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/LiveUpdatesContext.jsx';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner.js';
import ProductFormModal from './ProductFormModal.jsx';
import MovementModal from './MovementModal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import EmptyState from './EmptyState.jsx';
import { IconAlertTriangle, IconBox, IconBarcode, IconCamera } from './icons.jsx';

// La librería de decodificación (ZXing) pesa bastante: se carga solo cuando
// alguien realmente abre el escáner de cámara, no en cada visita a Productos.
const CameraScannerModal = lazy(() => import('./CameraScannerModal.jsx'));

const CAMERA_SUPPORTED = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

const currency = (n) =>
  Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [scannedSku, setScannedSku] = useState('');
  const [movementProduct, setMovementProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const { handleUnauthorized } = useAuth();
  const { notify } = useToast();
  const { lastEvent } = useLiveUpdates();

  async function loadProducts() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const data = await api.getProducts(params);
      setProducts(data);
    } catch (err) {
      if (err.status === 401) return handleUnauthorized();
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(loadProducts, 250);
    return () => clearTimeout(timeout);
    // Se vuelve a pedir también cuando otra pantalla conectada registra un
    // movimiento o cambia un producto, para reflejar el stock al día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, lastEvent]);

  async function handleCreateOrUpdate(form) {
    if (editing) {
      await api.updateProduct(editing.id, form);
      notify('Producto actualizado');
    } else {
      await api.createProduct(form);
      notify('Producto creado');
    }
    setFormOpen(false);
    setEditing(null);
    setScannedSku('');
    loadProducts();
  }

  async function handleMovement(data) {
    await api.createMovement(data);
    notify('Movimiento registrado');
    setMovementProduct(null);
    loadProducts();
  }

  async function handleDelete() {
    try {
      await api.deleteProduct(deleteTarget.id);
      notify('Producto eliminado');
      setDeleteTarget(null);
      loadProducts();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  const scannerEnabled = !formOpen && !movementProduct && !deleteTarget;
  const handleScan = useCallback(
    async (code) => {
      try {
        const product = await api.lookupProductByCode(code);
        setMovementProduct(product);
        notify(`Escaneado: ${product.name}`);
      } catch (err) {
        if (err.status === 401) return handleUnauthorized();
        // Ningún producto tiene ese código como SKU todavía: en vez de solo
        // avisar que no se encontró, se ofrece darlo de alta ahora mismo con
        // ese código ya puesto, para no tener que volver a escanearlo después.
        notify(`Código no encontrado — complétalo para agregarlo como producto nuevo`);
        setEditing(null);
        setScannedSku(code);
        setFormOpen(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useBarcodeScanner(handleScan, { enabled: scannerEnabled });

  function handleCameraDetected(code) {
    setCameraOpen(false);
    handleScan(code);
  }

  const emptyState = useMemo(
    () => !loading && products.length === 0,
    [loading, products]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold text-slate-800">Productos</h1>
        <button
          onClick={() => {
            setEditing(null);
            setScannedSku('');
            setFormOpen(true);
          }}
          className="btn-primary"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar por nombre o SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input sm:max-w-[200px]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {scannerEnabled && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500"
            title="Escanea un código de barras para registrar un movimiento al instante"
          >
            <motion.span
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <IconBarcode className="h-3.5 w-3.5" />
            </motion.span>
            Lector de código de barras activo
          </motion.span>
        )}
        {CAMERA_SUPPORTED && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setCameraOpen(true)}
            className="btn-secondary"
          >
            <IconCamera className="h-4 w-4" />
            Escanear con cámara
          </motion.button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {products.map((p) => (
                  <motion.tr
                    key={p.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      {p.sku && <div className="text-xs text-slate-400">SKU: {p.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.category}</td>
                    <td className="px-4 py-3 text-slate-700">{currency(p.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          p.lowStock
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {p.lowStock && <IconAlertTriangle className="h-3.5 w-3.5" />}
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setMovementProduct(p)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                        >
                          Movimiento
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                        >
                          Editar
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setDeleteTarget(p)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50"
                        >
                          Eliminar
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {loading && <LoadingSpinner label="Cargando productos…" />}
        {emptyState && (
          <EmptyState
            icon={IconBox}
            title="No hay productos que coincidan"
            message="Prueba agregando uno nuevo."
          />
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        product={editing}
        initialSku={scannedSku}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setScannedSku('');
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <MovementModal
        open={Boolean(movementProduct)}
        product={movementProduct}
        onClose={() => setMovementProduct(null)}
        onSubmit={handleMovement}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar producto"
        message={`¿Seguro que quieres eliminar "${deleteTarget?.name}"? También se borrará su historial de movimientos.`}
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
          <CameraScannerModal
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onDetected={handleCameraDetected}
          />
        </Suspense>
      )}
    </div>
  );
}
