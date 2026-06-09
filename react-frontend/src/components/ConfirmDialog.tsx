import type { ReactNode } from 'react'
import Modal from './Modal'

type Props = {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  loading = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal title={title} onClose={loading ? () => {} : onCancel}>
      <div className="confirm-dialog">
        <p className="confirm-dialog__message">{message}</p>
        {error ? <p className="error confirm-dialog__error">{error}</p> : null}
        <div className="crud-actions confirm-dialog__actions">
          <button
            type="button"
            className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'En cours…' : confirmLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
