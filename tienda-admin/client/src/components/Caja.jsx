import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/LiveUpdatesContext.jsx';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Modal from './Modal.jsx';
import EmptyState from './EmptyState.jsx';
import {
  IconWallet,
  IconLogOut,
  IconWifi,
  IconCamera,
  IconPlusCircle,
  IconMinusCircle,
  IconX,
  IconCheckCircle,
  IconStore,
} from './icons.jsx';

const CameraScannerModal = lazy(() => import('./CameraScannerModal.jsx'));
const CAMERA_SUPPORTED = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
const ALCOHOL_CATEGORIES = ['alcohol_mas_20', 'alcohol_hasta_20'];

const currency = (n) =>
  Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

export default function Caja() {
  const { logout, name, handleUnauthorized } = useAuth();
  const { notify } = useToast();
  const { connected } = useLiveUpdates();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ageConfirmProduct, setAgeConfirmProduct] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [amountReceived, setAmountReceived] = useState('');
  const [charging, setCharging] = useState(false);
  const [lastSale, setLastSale] = useState(null); // { saleId, total, change }
  const searchTimeout = useRef(null);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [cart]
  );

  function insertToCart(product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch('');
    setResults([]);
  }

  // Un producto de categoría alcohólica pide confirmar la edad la primera
  // vez que entra al carrito — no de nuevo si ya está y solo se suma otra
  // unidad.
  function addToCart(product) {
    const alreadyInCart = cart.some((l) => l.product.id === product.id);
    if (ALCOHOL_CATEGORIES.includes(product.taxCategory) && !alreadyInCart) {
      setAgeConfirmProduct(product);
      return;
    }
    insertToCart(product);
  }

  function confirmAge() {
    insertToCart(ageConfirmProduct);
    setAgeConfirmProduct(null);
  }

  function updateQuantity(productId, quantity) {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l))
    );
  }

  function handleSearch(value) {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await api.getProducts({ search: value, sellable: 1 });
        setResults(data.slice(0, 8));
      } catch (err) {
        if (err.status === 401) handleUnauthorized();
      }
    }, 200);
  }

  async function handleScan(code) {
    try {
      const product = await api.lookupProductByCode(code);
      addToCart(product);
    } catch (err) {
      if (err.status === 401) return handleUnauthorized();
      notify(`Código no encontrado: ${code}`, 'error');
    }
  }
  useBarcodeScanner(handleScan, {
    enabled: !cameraOpen && !ageConfirmProduct && !payOpen && !lastSale,
  });

  function handleCameraDetected(code) {
    setCameraOpen(false);
    handleScan(code);
  }

  const amountReceivedNumber = Number(amountReceived) || 0;
  const change = amountReceivedNumber - total;

  async function handleCharge() {
    setCharging(true);
    try {
      const result = await api.createSale({
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod,
        amountReceived: paymentMethod === 'efectivo' ? amountReceivedNumber : undefined,
      });
      setLastSale(result);
      setCart([]);
      setPayOpen(false);
      setAmountReceived('');
    } catch (err) {
      if (err.status === 401) return handleUnauthorized();
      notify(err.message, 'error');
    } finally {
      setCharging(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
            <IconStore className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Caja</p>
            {name && <p className="text-xs text-slate-400">{name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`flex items-center gap-1.5 text-xs font-medium ${
              connected ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <IconWifi className="h-4 w-4" />
            <span className="hidden sm:inline">{connected ? 'En vivo' : 'Sin conexión'}</span>
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <IconLogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Buscar producto por nombre o SKU…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {CAMERA_SUPPORTED && (
            <button onClick={() => setCameraOpen(true)} className="btn-secondary shrink-0" aria-label="Escanear">
              <IconCamera className="h-4 w-4" />
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="card mb-4 divide-y divide-slate-100 p-0">
            {results.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <IconStore className="h-3.5 w-3.5 text-slate-300" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-700">{product.name}</span>
                    {product.sku && <span className="text-xs text-slate-400">SKU: {product.sku}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-slate-500">{currency(product.price)}</span>
              </button>
            ))}
          </div>
        )}

        {cart.length === 0 ? (
          <EmptyState
            icon={IconWallet}
            title="El carrito está vacío"
            message="Busca o escanea un producto para agregarlo."
          />
        ) : (
          <div className="card divide-y divide-slate-100 p-0">
            <AnimatePresence initial={false}>
              {cart.map((line) => (
                <motion.div
                  key={line.product.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {line.product.imageUrl ? (
                      <img src={line.product.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <IconStore className="h-4 w-4 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{line.product.name}</p>
                    <p className="text-xs text-slate-400">{currency(line.product.price)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(line.product.id, line.quantity - 1)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="Restar"
                    >
                      <IconMinusCircle className="h-5 w-5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                    <button
                      onClick={() => updateQuantity(line.product.id, line.quantity + 1)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="Sumar"
                    >
                      <IconPlusCircle className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="w-20 shrink-0 text-right text-sm font-semibold text-slate-800">
                    {currency(line.product.price * line.quantity)}
                  </p>
                  <button
                    onClick={() => updateQuantity(line.product.id, 0)}
                    className="shrink-0 text-slate-300 hover:text-rose-500"
                    aria-label="Quitar"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {cart.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-lg font-semibold text-slate-800">Total: {currency(total)}</p>
            <button onClick={() => setPayOpen(true)} className="btn-primary px-6 py-3">
              Cobrar
            </button>
          </div>
        )}
      </main>

      <Suspense fallback={null}>
        <CameraScannerModal open={cameraOpen} onClose={() => setCameraOpen(false)} onDetected={handleCameraDetected} />
      </Suspense>

      <ConfirmDialog
        open={Boolean(ageConfirmProduct)}
        onClose={() => setAgeConfirmProduct(null)}
        onConfirm={confirmAge}
        title="Verificar edad"
        message={`"${ageConfirmProduct?.name}" es una bebida alcohólica. ¿Confirmaste que el cliente es mayor de edad (18+)? No se guarda ningún dato, es solo un recordatorio.`}
        confirmLabel="Sí, es mayor de edad"
        tone="ok"
      />

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Cobrar" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-center text-2xl font-semibold text-slate-800">{currency(total)}</p>
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
            <button
              onClick={() => setPaymentMethod('efectivo')}
              className={`flex-1 rounded-lg py-1.5 transition ${
                paymentMethod === 'efectivo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Efectivo
            </button>
            <button
              onClick={() => setPaymentMethod('tarjeta')}
              className={`flex-1 rounded-lg py-1.5 transition ${
                paymentMethod === 'tarjeta' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Tarjeta
            </button>
          </div>
          {paymentMethod === 'efectivo' && (
            <div>
              <label className="label">Monto recibido</label>
              <input
                type="number"
                min="0"
                className="input"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                autoFocus
              />
              {amountReceived !== '' && (
                <p className={`mt-1 text-sm ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {change >= 0 ? `Vuelto: ${currency(change)}` : 'El monto recibido es menor al total'}
                </p>
              )}
            </div>
          )}
          <button
            onClick={handleCharge}
            disabled={charging || (paymentMethod === 'efectivo' && (amountReceived === '' || change < 0))}
            className="btn-primary w-full"
          >
            {charging ? 'Cobrando…' : 'Confirmar cobro'}
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(lastSale)} onClose={() => setLastSale(null)} title="Venta registrada" width="max-w-sm">
        {lastSale && (
          <div className="space-y-4 text-center">
            <IconCheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="text-2xl font-semibold text-slate-800">{currency(lastSale.total)}</p>
            {lastSale.change > 0 && (
              <p className="text-sm text-slate-500">Vuelto: {currency(lastSale.change)}</p>
            )}
            <div className="flex justify-center gap-2">
              <button onClick={() => api.viewSaleReceipt(lastSale.saleId)} className="btn-secondary">
                Ver recibo
              </button>
              <button onClick={() => setLastSale(null)} className="btn-primary">
                Nueva venta
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
