const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20h9" {...stroke} />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" {...stroke} />
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

type Props = {
  onEdit: () => void
  onDelete?: () => void
  editLabel?: string
  deleteLabel?: string
}

/** Actions compactes (icônes) pour lignes de tableaux CRM. */
export default function TableRowActions({
  onEdit,
  onDelete,
  editLabel = 'Modifier',
  deleteLabel = 'Supprimer',
}: Props) {
  return (
    <div className="data-table__actions-inner">
      <button type="button" className="ds-icon-btn" title={editLabel} aria-label={editLabel} onClick={onEdit}>
        <IconPencil />
      </button>
      {onDelete ? (
        <button
          type="button"
          className="ds-icon-btn ds-icon-btn--danger"
          title={deleteLabel}
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <IconTrash />
        </button>
      ) : null}
    </div>
  )
}
