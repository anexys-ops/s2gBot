import type { ReactNode } from 'react'

export type ColumnToggleDef = { id: string; label: string }

type Props = {
  searchValue: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  statusValue?: string
  onStatusChange?: (v: string) => void
  statusOptions?: { value: string; label: string }[]
  columns?: ColumnToggleDef[]
  visibleColumns?: Record<string, boolean>
  onToggleColumn?: (id: string) => void
  extra?: ReactNode
  footer?: ReactNode
}

export default function ListTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  statusValue = '',
  onStatusChange,
  statusOptions,
  columns,
  visibleColumns,
  onToggleColumn,
  extra,
  footer,
}: Props) {
  const visibleColumnCount =
    columns && visibleColumns
      ? columns.filter((c) => visibleColumns[c.id] !== false).length
      : null

  return (
    <div className="card list-table-toolbar">
      <div className="list-table-toolbar__row">
        <label className="list-table-toolbar__field list-table-toolbar__search">
          <span className="filter-label">Recherche</span>
          <div className="list-table-toolbar__search-input-wrap">
            <input
              type="search"
              className="list-table-toolbar__search-input"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Recherche"
            />
            {searchValue.trim() !== '' && (
              <button
                type="button"
                className="list-table-toolbar__search-clear"
                onClick={() => onSearchChange('')}
                aria-label="Effacer la recherche"
                title="Effacer"
              >
                ×
              </button>
            )}
          </div>
        </label>

        {statusOptions && onStatusChange && (
          <label className="list-table-toolbar__field list-table-toolbar__status">
            <span className="filter-label">Filtre statut</span>
            <select value={statusValue} onChange={(e) => onStatusChange(e.target.value)}>
              <option value="">Tous</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {extra ? <div className="list-table-toolbar__extra">{extra}</div> : null}

        {columns && visibleColumns && onToggleColumn && (
          <details className="list-table-toolbar__columns">
            <summary>
              Colonnes affichées
              {visibleColumnCount != null && (
                <span className="list-table-toolbar__columns-count">{visibleColumnCount}</span>
              )}
            </summary>
            <div className="list-table-toolbar__columns-panel">
              {columns.map((c) => (
                <label key={c.id} className="list-table-toolbar__column-option">
                  <input
                    type="checkbox"
                    checked={visibleColumns[c.id] !== false}
                    onChange={() => onToggleColumn(c.id)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </details>
        )}
      </div>

      {footer ? <div className="list-table-toolbar__footer">{footer}</div> : null}
    </div>
  )
}

export function PaginationBar({
  page,
  lastPage,
  onPage,
}: {
  page: number
  lastPage: number
  onPage: (p: number) => void
}) {
  if (lastPage <= 1) return null
  return (
    <div className="crud-actions pagination-bar">
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </button>
      <span style={{ alignSelf: 'center', fontSize: '0.9rem' }}>
        Page {page} / {lastPage}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={page >= lastPage}
        onClick={() => onPage(page + 1)}
      >
        Suivant
      </button>
    </div>
  )
}
