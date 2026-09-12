import Modal from './Modal.jsx';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Eliminar' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="mb-6 text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button onClick={onConfirm} className="btn-danger">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
