import type { ReactNode } from 'react'
import { formatMoney } from '../lib/appLocale'
import { PaginationBar } from './ListTableToolbar'

export function ListTablePanelHeader({
  title,
  count,
  intro,
}: {
  title: string
  count: number
  intro?: ReactNode
}) {
  const countLabel = count === 1 ? '1 élément affiché' : `${count} éléments affichés`
  return (
    <div className="dossier-tab-panel__header">
      <div className="list-table-panel__title-row">
        <h2 className="ds-form-section__title">{title}</h2>
        <span className="list-table-panel__count" aria-label={countLabel}>
          {count}
        </span>
      </div>
      {intro ? <p className="dossier-tab-panel__intro">{intro}</p> : null}
    </div>
  )
}

export function ListTableFootLabel() {
  return (
    <td className="data-table__foot-label">
      <strong>Total</strong>
    </td>
  )
}

export function ListTableFootSpacer() {
  return <td aria-hidden="true" />
}

export function ListTableFootMoney({ value, className }: { value: number; className?: string }) {
  return (
    <td className={`data-table__num data-table__foot-value${className ? ` ${className}` : ''}`}>
      <strong>{formatMoney(value)}</strong>
    </td>
  )
}

export type ListTableFootColumn = { id: string; kind: 'text' | 'money'; span?: number }

export function ListTableFootRow({
  columns,
  visible,
  totals,
}: {
  columns: ListTableFootColumn[]
  visible: Record<string, boolean>
  totals: Partial<Record<string, number>>
}) {
  const hasVisibleMoney = columns.some((c) => c.kind === 'money' && visible[c.id] !== false)
  if (!hasVisibleMoney) return null

  let labelPlaced = false
  const cells: ReactNode[] = []

  for (const col of columns) {
    if (visible[col.id] === false) continue
    const span = col.span ?? 1
    if (col.kind === 'money') {
      cells.push(<ListTableFootMoney key={col.id} value={totals[col.id] ?? 0} />)
      continue
    }
    for (let i = 0; i < span; i += 1) {
      const key = `${col.id}-${i}`
      if (!labelPlaced) {
        labelPlaced = true
        cells.push(<ListTableFootLabel key={key} />)
      } else {
        cells.push(<ListTableFootSpacer key={key} />)
      }
    }
  }

  return (
    <tfoot>
      <tr className="data-table__foot-row">{cells}</tr>
    </tfoot>
  )
}

type ListTablePanelProps = {
  title: string
  count: number
  intro?: ReactNode
  children: ReactNode
  empty?: ReactNode
  page?: number
  lastPage?: number
  onPage?: (p: number) => void
  className?: string
}

export default function ListTablePanel({
  title,
  count,
  intro,
  children,
  empty,
  page,
  lastPage,
  onPage,
  className = '',
}: ListTablePanelProps) {
  return (
    <div
      className={`card dossier-tab-panel dossier-tab-panel--table list-table-panel${className ? ` ${className}` : ''}`}
    >
      <ListTablePanelHeader title={title} count={count} intro={intro} />
      {count > 0 ? children : empty}
      {page != null && lastPage != null && onPage ? (
        <PaginationBar page={page} lastPage={lastPage} onPage={onPage} />
      ) : null}
    </div>
  )
}
