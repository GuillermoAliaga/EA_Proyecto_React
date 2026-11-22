import { useEffect } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open, title, message,
  confirmText = 'Confirmar', cancelText = 'Cancelar',
  busy = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  // Escape cierra el modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title">{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onCancel} disabled={busy}>{cancelText}</button>
        <button type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Procesando…' : confirmText}
        </button>
      </div>
    </div>
  );
}