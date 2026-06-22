import { useMemo } from 'react'

export function shortCatalogueOptionLabel(code: string, label: string, max = 72) {
  const text = `${code} — ${label}`
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function togglePickerId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

type Props = {
  items: { id: number; label: string }[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  filter: string
  onFilterChange: (value: string) => void
  emptyLabel: string
}

export default function CatalogueMultiPicker({
  items,
  selectedIds,
  onChange,
  filter,
  onFilterChange,
  emptyLabel,
}: Props) {
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [filter, items])

  return (
    <div className="catalogue-article-new-form__picker">
      <input
        type="search"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Filtrer…"
        className="catalogue-article-new-form__picker-filter"
      />
      <div className="catalogue-article-new-form__picker-list" role="listbox" aria-multiselectable="true">
        {filtered.length === 0 ? (
          <p className="catalogue-article-new-form__picker-empty">{emptyLabel}</p>
        ) : (
          filtered.map((item) => {
            const checked = selectedIds.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={checked}
                className={`catalogue-article-new-form__picker-row${checked ? ' catalogue-article-new-form__picker-row--selected' : ''}`}
                onClick={() => onChange(togglePickerId(selectedIds, item.id))}
              >
                <span className="catalogue-article-new-form__picker-check" aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
                <span className="catalogue-article-new-form__picker-label">{item.label}</span>
              </button>
            )
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="catalogue-article-new-form__picker-count">{selectedIds.length} sélectionné(s)</p>
      )}
    </div>
  )
}
