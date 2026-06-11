import { Link } from 'react-router-dom'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function IconPdf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...stroke} />
      <path d="M14 2v6h6M9 13h6M9 17h4M9 9h1" {...stroke} />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20h9" {...stroke} />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" {...stroke} />
    </svg>
  )
}

function IconStatus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 7h16M4 12h10M4 17h7" {...stroke} />
      <path d="M18 10v6l2-2" {...stroke} />
    </svg>
  )
}

function IconMeta() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" {...stroke} />
      <circle cx="18" cy="18" r="2" {...stroke} />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 6h18" {...stroke} />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" {...stroke} />
      <path d="M5 6h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6z" {...stroke} />
      <path d="M10 11v6M14 11v6" {...stroke} />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" {...stroke} />
      <path d="m22 6-10 7L2 6" {...stroke} />
    </svg>
  )
}

type PdfButtonProps = {
  onClick: () => void
  label?: string
}

export function QuotePdfButton({ onClick, label = 'Télécharger le PDF' }: PdfButtonProps) {
  return (
    <button
      type="button"
      className="ds-icon-btn ds-icon-btn--pdf"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <IconPdf />
    </button>
  )
}

type RowActionsProps = {
  quoteId: number
  quoteNumber: string
  status: string
  isAdmin: boolean
  onStatus: () => void
  onMeta: () => void
  onDelete: () => void
  onSendEmail?: () => void
  sendEmailLoading?: boolean
}

export function QuoteRowActions({
  quoteId,
  quoteNumber,
  status,
  isAdmin,
  onStatus,
  onMeta,
  onDelete,
  onSendEmail,
  sendEmailLoading = false,
}: RowActionsProps) {
  const canSendEmail = status !== 'sent' && onSendEmail != null

  return (
    <div className="data-table__actions-inner">
      <Link
        to={`/devis/${quoteId}/editer`}
        className="ds-icon-btn"
        title={status === 'draft' ? 'Modifier le devis' : 'Ouvrir le devis'}
        aria-label={`${status === 'draft' ? 'Modifier' : 'Ouvrir'} le devis ${quoteNumber}`}
      >
        <IconPencil />
      </Link>
      {canSendEmail ? (
        <button
          type="button"
          className="ds-icon-btn"
          title="Envoyer par email"
          aria-label={`Envoyer le devis ${quoteNumber} par email`}
          onClick={onSendEmail}
          disabled={sendEmailLoading}
        >
          <IconMail />
        </button>
      ) : null}
      <button
        type="button"
        className="ds-icon-btn"
        title="Changer le statut"
        aria-label={`Changer le statut du devis ${quoteNumber}`}
        onClick={onStatus}
      >
        <IconStatus />
      </button>
      <button
        type="button"
        className="ds-icon-btn"
        title="Métadonnées"
        aria-label={`Métadonnées du devis ${quoteNumber}`}
        onClick={onMeta}
      >
        <IconMeta />
      </button>
      {isAdmin ? (
        <button
          type="button"
          className="ds-icon-btn ds-icon-btn--danger"
          title="Supprimer le devis"
          aria-label={`Supprimer le devis ${quoteNumber}`}
          onClick={onDelete}
        >
          <IconTrash />
        </button>
      ) : null}
    </div>
  )
}
