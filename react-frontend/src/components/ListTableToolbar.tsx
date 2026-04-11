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
}: Props) {
  return (
    <div
      className="card list-table-toolbar"
      style={{
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'flex-end',
      }}
    >
      <label style={{ flex: '1 1 220px', margin: 0 }}>
        <span style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--muted, #64748b)' }}>
          Recherche
        </span>
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ width: '100%' }}
        />
      </label>
      {statusOptions && onStatusChange && (
        <label style={{ minWidth: 160, margin: 0 }}>
          <span style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--muted, #64748b)' }}>
            Filtre statut
          </span>
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
      {columns && visibleColumns && onToggleColumn && (
        <details style={{ minWidth: 200 }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Colonnes affichées</summary>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {columns.map((c) => (
              <label key={c.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={visibleColumns[c.id] !== false}
                  onChange={() => onToggleColumn(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </details>
      )}
      {extra}
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
    <div className="crud-actions" style={{ padding: '0.75rem', justifyContent: 'center', gap: '1rem' }}>
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
