import type { ReactNode } from 'react'
import TableIconHeader from '../TableIconHeader'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" {...stroke} />
      <circle cx="12" cy="12" r="3" {...stroke} />
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

function ActionSlot({ children }: { children?: ReactNode }) {
  return <div className="data-table__action-slot">{children}</div>
}

type PdfButtonProps = {
  onClick: () => void
  label?: string
}

export function QuotePdfButton({ onClick, label = 'Voir le PDF' }: PdfButtonProps) {
  return (
    <button
      type="button"
      className="ds-icon-btn ds-icon-btn--pdf"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <IconEye />
    </button>
  )
}

type RowActionCellsProps = {
  quoteNumber: string
  status: string
  isAdmin: boolean
  onMeta: () => void
  onDelete: () => void
  onSendEmail?: () => void
  sendEmailLoading?: boolean
}

/** Colonnes d’actions secondaires — édition et statut via clic ligne / badge. */
export function QuoteRowActionCells({
  quoteNumber,
  status,
  isAdmin,
  onMeta,
  onDelete,
  onSendEmail,
  sendEmailLoading = false,
}: RowActionCellsProps) {
  const canSendEmail = status === 'draft' && onSendEmail != null

  return (
    <>
      <td className="data-table__action-cell">
        <ActionSlot>
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
        </ActionSlot>
      </td>
      <td className="data-table__action-cell">
        <ActionSlot>
          <button
            type="button"
            className="ds-icon-btn"
            title="Métadonnées"
            aria-label={`Métadonnées du devis ${quoteNumber}`}
            onClick={onMeta}
          >
            <IconMeta />
          </button>
        </ActionSlot>
      </td>
      <td className="data-table__action-cell">
        <ActionSlot>
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
        </ActionSlot>
      </td>
    </>
  )
}

export function QuoteRowActionHeaders() {
  return (
    <>
      <TableIconHeader icon={<IconMail />} label="Envoyer par email" />
      <TableIconHeader icon={<IconMeta />} label="Métadonnées" />
      <TableIconHeader icon={<IconTrash />} label="Supprimer" />
    </>
  )
}
