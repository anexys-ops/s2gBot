import type { ReactNode } from 'react'
import TableIconHeader from '../TableIconHeader'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
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

function ActionSlot({ children }: { children?: ReactNode }) {
  return <div className="data-table__action-slot">{children}</div>
}

type RowActionCellsProps = {
  bcNumero: string
  canDelete: boolean
  onMeta?: () => void
  onDelete?: () => void
}

/** Colonnes d’actions secondaires — édition et statut via clic ligne / badge. */
export function BonCommandeRowActionCells({
  bcNumero,
  canDelete,
  onMeta,
  onDelete,
}: RowActionCellsProps) {
  return (
    <>
      <td className="data-table__action-cell">
        <ActionSlot>
          {onMeta ? (
            <button
              type="button"
              className="ds-icon-btn"
              title="Métadonnées devis"
              aria-label={`Métadonnées du devis lié au bon ${bcNumero}`}
              onClick={onMeta}
            >
              <IconMeta />
            </button>
          ) : null}
        </ActionSlot>
      </td>
      <td className="data-table__action-cell">
        <ActionSlot>
          {canDelete && onDelete ? (
            <button
              type="button"
              className="ds-icon-btn ds-icon-btn--danger"
              title="Supprimer le bon de commande"
              aria-label={`Supprimer le bon ${bcNumero}`}
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

export function BonCommandeRowActionHeaders() {
  return (
    <>
      <TableIconHeader icon={<IconMeta />} label="Métadonnées devis" />
      <TableIconHeader icon={<IconTrash />} label="Supprimer" />
    </>
  )
}
