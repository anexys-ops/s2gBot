import { useEffect, useRef, useState } from 'react'
import { geocodeApi, type GeocodeResult } from '../api/client'

type Props = {
  value: string
  onChange: (value: string) => void
  onSelect: (result: GeocodeResult) => void
  placeholder?: string
  className?: string
  id?: string
}

/** Champ adresse avec suggestions géocodées (Nominatim/OSM, biaisé Maroc). */
export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className, id }: Props) {
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const query = value.trim()
    if (query.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      geocodeApi
        .search(query)
        .then((results) => {
          setSuggestions(results)
          setOpen(results.length > 0)
        })
        .catch(() => {
          setSuggestions([])
          setOpen(false)
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [value])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="address-autocomplete" ref={containerRef}>
      <input
        id={id}
        type="text"
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading ? <span className="address-autocomplete__loading">Recherche…</span> : null}
      {open && suggestions.length > 0 ? (
        <ul className="address-autocomplete__list">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s)
                  setOpen(false)
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
