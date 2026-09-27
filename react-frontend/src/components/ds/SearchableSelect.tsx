import { useState, useRef, useEffect } from 'react'

export type SearchableSelectOption = {
  id: string | number
  label: string
}

type Props = {
  options: SearchableSelectOption[]
  value: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  emptyLabel?: string
  className?: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Rechercher…',
  emptyLabel = 'Non assigné',
  className = '',
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedOption = options.find((opt) => String(opt.id) === String(value))

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      inputRef.current?.focus()
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
      }}
      className={className}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          borderRadius: 4,
          border: '1px solid #d1d5db',
          background: 'white',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.9rem',
          color: value ? '#1f2937' : '#9ca3af',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{selectedOption?.label || emptyLabel}</span>
        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: 'white',
            borderRadius: 4,
            border: '1px solid #d1d5db',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
          }}
        >
          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid #e5e7eb',
              borderRadius: '4px 4px 0 0',
              border: 'none',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
            }}
          />

          {/* Options list */}
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {/* Empty option */}
            <button
              type="button"
              onClick={() => {
                onChange('')
                setIsOpen(false)
                setSearchTerm('')
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: value === '' ? '#f0fdf4' : 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#6b7280',
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseEnter={(e) => {
                if (value === '') e.currentTarget.style.background = '#f0fdf4'
                else e.currentTarget.style.background = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                if (value === '') e.currentTarget.style.background = '#f0fdf4'
                else e.currentTarget.style.background = 'transparent'
              }}
            >
              {emptyLabel}
            </button>

            {/* Filtered options */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: String(option.id) === String(value) ? '#f0fdf4' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: '#1f2937',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                  onMouseEnter={(e) => {
                    if (String(option.id) === String(value)) e.currentTarget.style.background = '#f0fdf4'
                    else e.currentTarget.style.background = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    if (String(option.id) === String(value)) e.currentTarget.style.background = '#f0fdf4'
                    else e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '0.85rem',
                }}
              >
                Aucun résultat trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
