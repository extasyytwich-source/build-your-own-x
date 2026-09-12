import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ProductFormModal from './ProductFormModal.jsx';
import MovementModal from './MovementModal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

const currency = (n) =>
  Number(n || 0).toLocaleString('es', { style: 'currency', currency: 'USD' });

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [movementProduct, setMovementProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { handleUnauthorized } = useAuth();
  const { notify } = useToast();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

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

  const emptyState = useMemo(
    () => !loading && products.length === 0,
    [loading, products]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500">Administra el catálogo disponible en la tienda.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="btn-primary"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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
                        {p.lowStock && '⚠️'} {p.stock} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setMovementProduct(p)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                        >
                          Movimiento
                        </button>
                        <button
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {loading && <div className="py-12 text-center text-sm text-slate-400">Cargando…</div>}
        {emptyState && (
          <div className="py-12 text-center text-sm text-slate-400">
            No hay productos que coincidan. Prueba agregando uno nuevo.
          </div>
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        product={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
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
    </div>
  );
}
