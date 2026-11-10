import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '../api/client'
import { LIST_SORT_LABELS, type ListControls, type ListSortKey, type ListSortOption } from '../hooks/useListControls'

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
  className?: string
  /** Tri et filtres communs (useListControls) — même présentation sur toutes les listes. */
  listControls?: ListControls
  /** Clés de tri proposées (libellé standard, surchargeable). */
  sortOptions?: Array<ListSortKey | ListSortOption>
  /** Affiche le filtre Client (listes rattachées à un client). */
  clientFilter?: boolean
  /** Affiche le filtre Période (date de création). */
  periodFilter?: boolean
}

function ListClientSelect({ value, onChange }: { value: number | ''; onChange: (id: number | '') => void }) {
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'select-options'],
    queryFn: () => clientsApi.list(),
    staleTime: 120_000,
  })
  return (
    <label className="list-table-toolbar__field list-table-toolbar__client">
      <span className="filter-label">Client</span>
      <select value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
        <option value="">Tous les clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </label>
  )
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
  className = '',
  listControls,
  sortOptions,
  clientFilter = false,
  periodFilter = false,
}: Props) {
  const sorts = (sortOptions ?? []).map((o) => (typeof o === 'string' ? { key: o } : o))
  const visibleColumnCount =
    columns && visibleColumns
      ? columns.filter((c) => visibleColumns[c.id] !== false).length
      : null

  return (
    <div className={`card list-table-toolbar${className ? ` ${className}` : ''}`}>
      <div className="list-table-toolbar__row">
        <label className="list-table-toolbar__field list-table-toolbar__search">
          <span className="filter-label">Recherche</span>
          <div className="list-table-toolbar__search-input-wrap">
            <input
              type="text"
              role="searchbox"
              className="list-table-toolbar__search-input"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Recherche"
              autoComplete="off"
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

        {listControls && clientFilter ? (
          <ListClientSelect value={listControls.clientId} onChange={listControls.setClientId} />
        ) : null}

        {extra ? <div className="list-table-toolbar__extra">{extra}</div> : null}

        {listControls && sorts.length > 0 ? (
          <div className="list-table-toolbar__field list-table-toolbar__sort">
            <span className="filter-label">Trier par</span>
            <div className="list-table-toolbar__sort-row">
              <label className="list-table-toolbar__field">
                <select
                  value={listControls.sort}
                  onChange={(e) => listControls.setSort(e.target.value as ListSortKey)}
                  aria-label="Trier par"
                >
                  {sorts.map((o) => (
                    <option key={o.key} value={o.key}>{o.label ?? LIST_SORT_LABELS[o.key]}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm list-table-toolbar__sort-dir"
                onClick={listControls.toggleDirection}
                title={listControls.direction === 'desc' ? 'Ordre décroissant — cliquer pour inverser' : 'Ordre croissant — cliquer pour inverser'}
                aria-label={listControls.direction === 'desc' ? 'Ordre décroissant' : 'Ordre croissant'}
              >
                {listControls.direction === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        ) : null}

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

      {listControls && periodFilter ? (
        <div className="list-table-toolbar__row list-table-toolbar__period">
          <label className="list-table-toolbar__field">
            <span className="filter-label">Créé du</span>
            <input
              type="date"
              value={listControls.createdFrom}
              onChange={(e) => listControls.setCreatedFrom(e.target.value)}
            />
          </label>
          <label className="list-table-toolbar__field">
            <span className="filter-label">au</span>
            <input
              type="date"
              value={listControls.createdTo}
              onChange={(e) => listControls.setCreatedTo(e.target.value)}
            />
          </label>
          {listControls.activeFilterCount > 0 ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={listControls.reset}>
              Réinitialiser tri et filtres
            </button>
          ) : null}
        </div>
      ) : null}

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
