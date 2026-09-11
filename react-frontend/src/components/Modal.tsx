import type { ReactNode } from 'react'

type ModalProps = {
  title: string
  children: ReactNode
  onClose: () => void
  /** default 520px · wide 720px · xl 920px */
  size?: 'default' | 'wide' | 'xl'
}

export default function Modal({ title, children, onClose, size = 'default' }: ModalProps) {
  const boxClass =
    size === 'xl' ? 'modal-box modal-box--xl' : size === 'wide' ? 'modal-box modal-box--wide' : 'modal-box'

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className={boxClass}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
