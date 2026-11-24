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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          padding: '1.5rem',
          borderRadius: '8px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <h2 id="modal-title" style={{ marginTop: 0 }}>{title}</h2>
        <p>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onCancel} disabled={busy}>{cancelText}</button>
          <button type="button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Procesando…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}