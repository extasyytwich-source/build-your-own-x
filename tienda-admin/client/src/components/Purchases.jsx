import { Fragment, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/LiveUpdatesContext.jsx';
import PurchaseOrderFormModal from './PurchaseOrderFormModal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import EmptyState from './EmptyState.jsx';
import { IconTruck, IconUsers, IconX, IconChevronDown } from './icons.jsx';

const currency = (n) => Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

const STATUS_STYLE = {
  pendiente: 'bg-amber-50 text-amber-700',
  recibida: 'bg-emerald-50 text-emerald-700',
  cancelada: 'bg-slate-100 text-slate-500',
};
const STATUS_LABEL = { pendiente: 'Pendiente', recibida: 'Recibida', cancelada: 'Cancelada' };

export default function Purchases() {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());

  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState(null);

  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contactName: '', phone: '', email: '', notes: '' });
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const { handleUnauthorized } = useAuth();
  const { notify } = useToast();
  const { lastEvent } = useLiveUpdates();

  async function loadAll() {
    setLoading(true);
    try {
      const [ordersData, suppliersData, productsData, locationsData] = await Promise.all([
        api.getPurchaseOrders(),
        api.getSuppliers(),
        api.getProducts({ sellable: 1 }),
        api.getLocations(),
      ]);
      setOrders(ordersData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      setLocations(locationsData);
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
  }, [lastEvent]);

  function toggleExpanded(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateOrder(data) {
    await api.createPurchaseOrder(data);
    notify('Orden de compra creada');
    setOrderFormOpen(false);
    loadAll();
  }

  function handleProductCreated(product) {
    setProducts((prev) => [...prev, product]);
  }

  async function handleReceive() {
    try {
      await api.receivePurchaseOrder(receiveTarget.id);
      notify('Orden recibida: se actualizó el stock y el costo de cada producto');
      setReceiveTarget(null);
      loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleCancel() {
    try {
      await api.cancelPurchaseOrder(cancelTarget.id);
      notify('Orden cancelada');
      setCancelTarget(null);
      loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeleteOrder() {
    try {
      await api.deletePurchaseOrder(deleteOrderTarget.id);
      notify('Orden eliminada');
      setDeleteOrderTarget(null);
      loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  function openNewSupplier() {
    setEditingSupplier(null);
    setSupplierForm({ name: '', contactName: '', phone: '', email: '', notes: '' });
    setSupplierFormOpen(true);
  }

  function openEditSupplier(supplier) {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      notes: supplier.notes || '',
    });
    setSupplierFormOpen(true);
  }

  async function handleSaveSupplier(e) {
    e.preventDefault();
    setSavingSupplier(true);
    try {
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, supplierForm);
        notify('Proveedor actualizado');
      } else {
        await api.createSupplier(supplierForm);
        notify('Proveedor creado');
      }
      setSupplierFormOpen(false);
      loadAll();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleDeleteSupplier() {
    try {
      await api.deleteSupplier(deleteSupplierTarget.id);
      notify('Proveedor eliminado');
      setDeleteSupplierTarget(null);
      loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold text-slate-800">Compras</h1>
        {tab === 'orders' ? (
          <button
            onClick={() => setOrderFormOpen(true)}
            disabled={suppliers.length === 0}
            className="btn-primary"
            title={suppliers.length === 0 ? 'Agrega un proveedor primero' : undefined}
          >
            + Nueva orden
          </button>
        ) : (
          <button onClick={openNewSupplier} className="btn-primary">
            + Nuevo proveedor
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium sm:w-fit">
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
            tab === 'orders' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
          }`}
        >
          <IconTruck className="h-4 w-4" />
          Órdenes de compra
        </button>
        <button
          onClick={() => setTab('suppliers')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
            tab === 'suppliers' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
          }`}
        >
          <IconUsers className="h-4 w-4" />
          Proveedores
        </button>
      </div>

      {loading && <LoadingSpinner label="Cargando…" />}

      {!loading && tab === 'orders' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isExpanded = expanded.has(order.id);
                  return (
                    <Fragment key={order.id}>
                      <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleExpanded(order.id)}
                            className="flex items-center gap-1.5 font-medium text-slate-800"
                          >
                            <motion.span animate={{ rotate: isExpanded ? 180 : 0 }}>
                              <IconChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            </motion.span>
                            {order.supplierName}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[order.status]}`}
                          >
                            {STATUS_LABEL[order.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{currency(order.total)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString('es-CL')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {order.status === 'pendiente' && (
                              <>
                                <button
                                  onClick={() => setReceiveTarget(order)}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                                >
                                  Recibir
                                </button>
                                <button
                                  onClick={() => setCancelTarget(order)}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            {order.status !== 'recibida' && (
                              <button
                                onClick={() => setDeleteOrderTarget(order)}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-slate-50 bg-slate-50/40 last:border-0">
                          <td colSpan={5} className="px-4 py-3">
                            <ul className="space-y-1 text-sm text-slate-600">
                              {order.items.map((item) => (
                                <li key={item.id} className="flex justify-between">
                                  <span>
                                    {item.quantity} × {item.productName}
                                  </span>
                                  <span>{currency(item.unitCost * item.quantity)}</span>
                                </li>
                              ))}
                            </ul>
                            {locations.length > 1 && order.locationName && (
                              <p className="mt-2 text-xs text-slate-400">Recibe en: {order.locationName}</p>
                            )}
                            {order.notes && (
                              <p className="mt-2 text-xs text-slate-400">Notas: {order.notes}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && (
            <EmptyState icon={IconTruck} title="No hay órdenes de compra" message="Crea una para reponer stock." />
          )}
        </div>
      )}

      {!loading && tab === 'suppliers' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.contactName || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{s.email || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openEditSupplier(s)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDeleteSupplierTarget(s)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {suppliers.length === 0 && (
            <EmptyState icon={IconUsers} title="No hay proveedores" message="Agrega uno para poder crear órdenes de compra." />
          )}
        </div>
      )}

      <PurchaseOrderFormModal
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
        onSubmit={handleCreateOrder}
        suppliers={suppliers}
        products={products}
        locations={locations}
        onProductCreated={handleProductCreated}
      />

      <ConfirmDialog
        open={Boolean(receiveTarget)}
        onClose={() => setReceiveTarget(null)}
        onConfirm={handleReceive}
        title="Recibir orden de compra"
        message={`¿Confirmas que llegó la mercadería de "${receiveTarget?.supplierName}"? Se sumará al stock de cada producto y se actualizará su costo.`}
        confirmLabel="Recibir"
        tone="primary"
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancelar orden de compra"
        message={`¿Seguro que quieres cancelar la orden a "${cancelTarget?.supplierName}"?`}
        confirmLabel="Cancelar orden"
      />

      <ConfirmDialog
        open={Boolean(deleteOrderTarget)}
        onClose={() => setDeleteOrderTarget(null)}
        onConfirm={handleDeleteOrder}
        title="Eliminar orden de compra"
        message="¿Seguro que quieres eliminar esta orden?"
      />

      <ConfirmDialog
        open={Boolean(deleteSupplierTarget)}
        onClose={() => setDeleteSupplierTarget(null)}
        onConfirm={handleDeleteSupplier}
        title="Eliminar proveedor"
        message={`¿Seguro que quieres eliminar "${deleteSupplierTarget?.name}"?`}
      />

      <AnimatePresence>
        {supplierFormOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onClick={() => setSupplierFormOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="card w-full max-w-md p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
                </h2>
                <button
                  onClick={() => setSupplierFormOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSaveSupplier} className="space-y-3">
                <input
                  required
                  className="input"
                  placeholder="Nombre*"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Nombre de contacto"
                  value={supplierForm.contactName}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, contactName: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Teléfono"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <input
                  type="email"
                  className="input"
                  placeholder="Correo"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
                />
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Notas"
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setSupplierFormOpen(false)} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingSupplier} className="btn-primary">
                    {savingSupplier ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
