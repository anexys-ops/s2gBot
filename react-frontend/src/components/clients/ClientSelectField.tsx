import { useEffect, useMemo, useState } from 'react'
import type { Client } from '../../api/client'

export type ClientSelectOption = Pick<Client, 'id' | 'name'> &
  Partial<Pick<Client, 'email' | 'city' | 'ice'>>

type Props = {
  clients: ClientSelectOption[]
  value: number | null | undefined | 0
  onChange: (id: number) => void
  label?: string
  required?: boolean
  disabled?: boolean
}

function matchesClient(client: ClientSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    client.name.toLowerCase().includes(q) ||
    client.email?.toLowerCase().includes(q) ||
    client.city?.toLowerCase().includes(q) ||
    client.ice?.toLowerCase().includes(q) ||
    String(client.id).includes(q)
  )
}

export default function ClientSelectField({
  clients,
  value,
  onChange,
  label = 'Client',
  required = false,
  disabled = false,
}: Props) {
  const [search, setSearch] = useState('')
  const selectedId = value && value > 0 ? value : null
  const selected = selectedId
    ? clients.find((c) => c.id === selectedId) ?? { id: selectedId, name: `Client #${selectedId}` }
    : undefined

  useEffect(() => {
    setSearch('')
  }, [selectedId])

  const filtered = useMemo(() => {
    const list = clients.filter((c) => matchesClient(c, search))
    if (selected && !list.some((c) => c.id === selected.id) && !search.trim()) {
      return [selected, ...list.filter((c) => c.id !== selected.id)]
    }
    return list
  }, [clients, search, selected])

  return (
    <div className="form-group client-select-field">
      <label htmlFor="client-select-search">
        {label}
        {required && ' *'}
      </label>
      {required ? <input type="hidden" value={selectedId ?? ''} required tabIndex={-1} aria-hidden /> : null}
      <input
        id="client-select-search"
        type="text"
        role="searchbox"
        className="client-select-field__search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom, ville, email, ICE…"
        disabled={disabled}
        autoComplete="off"
        aria-controls="client-select-listbox"
        aria-expanded={filtered.length > 0}
      />
      {selected ? (
        <p className="client-select-field__selected">
          Sélectionné : <strong>{selected.name}</strong>
        </p>
      ) : null}
      <div
        id="client-select-listbox"
        className="client-select-field__list"
        role="listbox"
        aria-label={label}
      >
        {filtered.length === 0 ? (
          <p className="client-select-field__empty">Aucun client ne correspond à cette recherche.</p>
        ) : (
          filtered.map((c) => {
            const isSelected = c.id === selectedId
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`client-select-field__option${isSelected ? ' client-select-field__option--selected' : ''}`}
                disabled={disabled}
                onClick={() => onChange(c.id)}
              >
                <span className="client-select-field__option-name">{c.name}</span>
                {(c.city || c.email) && (
                  <span className="client-select-field__option-meta">
                    {[c.city, c.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
