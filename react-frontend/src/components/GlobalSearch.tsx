import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { globalSearchApi, type GlobalSearchResult } from '../api/client'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

const TYPE_ICONS: Record<string, string> = {
  client: '🏢', contact: '👤', devis: '📋', facture: '🧾', article: '📦',
}
const TYPE_LABELS: Record<string, string> = {
  client: 'Client', contact: 'Contact', devis: 'Devis', facture: 'Facture', article: 'Article',
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQ = useDebouncedValue(input, 280)

  const { data } = useQuery({
    queryKey: ['global-search', debouncedQ],
    queryFn: () => globalSearchApi.search(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  })

  const results: GlobalSearchResult[] = data?.results ?? []

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 30)
      }
      if (e.key === 'Escape') { setOpen(false); setInput('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const go = useCallback((r: GlobalSearchResult) => {
    navigate(r.url)
    setOpen(false)
    setInput('')
    setSelectedIdx(-1)
  }, [navigate])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((p) => Math.min(p + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((p) => Math.max(p - 1, -1)) }
    else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) go(results[selectedIdx])
    else if (e.key === 'Escape') { setOpen(false); setInput('') }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        className="nav-aide-link"
        title="Recherche globale (Ctrl+K)"
        aria-label="Recherche globale"
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 30) }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.5rem' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>Ctrl+K</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '2.4rem', right: 0, zIndex: 9999,
          background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '0.75rem', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', width: 400,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '0.65rem 0.9rem', borderBottom: '1px solid var(--color-border, #e5e7eb)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.5, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="search"
              placeholder="Clients, devis, factures, articles…"
              value={input}
              onChange={(e) => { setInput(e.target.value); setSelectedIdx(-1) }}
              onKeyDown={onKeyDown}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.92rem', background: 'transparent' }}
              autoFocus
            />
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {debouncedQ.length < 2 && (
              <p style={{ padding: '0.9rem 1rem', color: 'var(--color-muted, #6b7280)', fontSize: '0.83rem', margin: 0, textAlign: 'center' }}>
                Tapez au moins 2 caractères…
              </p>
            )}
            {debouncedQ.length >= 2 && results.length === 0 && (
              <p style={{ padding: '0.9rem 1rem', color: 'var(--color-muted, #6b7280)', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>
                Aucun résultat pour « {debouncedQ} »
              </p>
            )}
            {results.map((r, idx) => (
              <button
                key={`${r.type}-${r.id}-${idx}`}
                type="button"
                onClick={() => go(r)}
                onMouseEnter={() => setSelectedIdx(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%',
                  padding: '0.55rem 0.9rem', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: selectedIdx === idx ? 'var(--color-bg, #f9fafb)' : 'transparent',
                  borderBottom: '1px solid var(--color-border-light, #f3f4f6)',
                }}
              >
                <span style={{ fontSize: '1rem', minWidth: 22, textAlign: 'center' }}>{TYPE_ICONS[r.type] ?? '🔍'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--color-muted, #6b7280)' }}>
                    {TYPE_LABELS[r.type] ?? r.type}{r.sub ? ` — ${r.sub}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
