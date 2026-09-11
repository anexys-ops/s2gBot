import { useEffect, useMemo, useState } from 'react'
import type { Site } from '../../api/client'

export type SiteSelectOption = Pick<Site, 'id' | 'name' | 'client_id'> &
  Partial<Pick<Site, 'reference' | 'address'>>

type Props = {
  sites: SiteSelectOption[]
  value: number | null | undefined | 0
  onChange: (id: number) => void
  label?: string
  required?: boolean
  disabled?: boolean
  loading?: boolean
  emptyMessage?: string
}

function matchesSite(site: SiteSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    site.name.toLowerCase().includes(q) ||
    site.reference?.toLowerCase().includes(q) ||
    site.address?.toLowerCase().includes(q) ||
    String(site.id).includes(q)
  )
}

export default function SiteSelectField({
  sites,
  value,
  onChange,
  label = 'Chantier',
  required = false,
  disabled = false,
  loading = false,
  emptyMessage = 'Aucun chantier ne correspond à cette recherche.',
}: Props) {
  const [search, setSearch] = useState('')
  const selectedId = value && Number(value) > 0 ? Number(value) : null
  const selected = selectedId
    ? sites.find((s) => s.id === selectedId) ?? { id: selectedId, name: `Chantier #${selectedId}`, client_id: 0 }
    : undefined

  useEffect(() => {
    setSearch('')
  }, [selectedId])

  const filtered = useMemo(() => {
    const list = sites.filter((s) => matchesSite(s, search))
    if (selected && !list.some((s) => s.id === selected.id) && !search.trim()) {
      return [selected, ...list.filter((s) => s.id !== selected.id)]
    }
    return list
  }, [sites, search, selected])

  return (
    <div className="form-group site-select-field">
      <label htmlFor="site-select-search">
        {label}
        {required && ' *'}
      </label>
      {required ? <input type="hidden" value={selectedId ?? ''} required tabIndex={-1} aria-hidden /> : null}
      <input
        id="site-select-search"
        type="text"
        role="searchbox"
        className="site-select-field__search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom, référence, adresse…"
        disabled={disabled || loading}
        autoComplete="off"
        aria-controls="site-select-listbox"
        aria-expanded={filtered.length > 0}
      />
      {selected ? (
        <p className="site-select-field__selected">
          Sélectionné : <strong>{selected.name}</strong>
          {selected.reference?.trim() ? ` (${selected.reference})` : ''}
        </p>
      ) : null}
      {loading ? (
        <p className="site-select-field__empty">Chargement des chantiers…</p>
      ) : sites.length === 0 ? (
        <p className="site-select-field__empty">Aucun chantier pour ce client.</p>
      ) : (
        <div id="site-select-listbox" className="site-select-field__list" role="listbox" aria-label={label}>
          {filtered.length === 0 ? (
            <p className="site-select-field__empty">{emptyMessage}</p>
          ) : (
            filtered.map((s) => {
              const isSelected = s.id === selectedId
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`site-select-field__option${isSelected ? ' site-select-field__option--selected' : ''}`}
                  disabled={disabled}
                  onClick={() => onChange(s.id)}
                >
                  <span className="site-select-field__option-name">{s.name}</span>
                  {(s.reference || s.address) && (
                    <span className="site-select-field__option-meta">
                      {[s.reference, s.address].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
