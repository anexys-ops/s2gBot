import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  label: string
}

/** En-tête de colonne icône seule (title + aria-label pour l’accessibilité). */
export default function TableIconHeader({ icon, label }: Props) {
  return (
    <th className="data-table__action-cell" title={label} aria-label={label}>
      <span className="data-table__icon-header" aria-hidden="true">
        {icon}
      </span>
    </th>
  )
}
