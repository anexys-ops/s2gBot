import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rapportBCApi, type RapportBC, type RapportBCBonCommande } from '../../api/client'
import { formatAppDate } from '../../lib/appLocale'
import { useAuth } from '../../contexts/AuthContext'

const STATUT_META: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:    { label: 'Brouillon',    color: '#6b7280', bg: '#f3f4f6' },
  preliminaire: { label: 'Préliminaire', color: '#f59e0b', bg: '#fef3c7' },
  valide:       { label: 'Validé',       color: '#10b981', bg: '#d1fae5' },
  archive:      { label: 'Archivé',      color: '#8b5cf6', bg: '#ede9fe' },
}

const TABS = [
  { key: '', label: 'Tous' },
  { key: 'preliminaire', label: 'En attente de validation' },
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'valide', label: 'Validés' },
  { key: 'archive', label: 'Archivés' },
]

function StatutBadge({ statut }: { statut: string }) {
  const meta = STATUT_META[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 12, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  )
}

function BcPickerModal({
  bcs,
  selected,
  onSelect,
  onClose,
}: {
  bcs: RapportBCBonCommande[]
  selected: number | ''
  onSelect: (id: number) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return s ? bcs.filter((bc) => bc.numero.toLowerCase().includes(s) || (bc.client?.name ?? '').toLowerCase().includes(s)) : bcs
  }, [bcs, search])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Sélectionner un bon de commande</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6b7280' }}>✕</button>
          </div>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              autoFocus
              type="text"
              placeholder="Rechercher par numéro ou client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 6 }}>{filtered.length} bon{filtered.length !== 1 ? 's' : ''} de commande</div>
        </div>
        {/* Liste */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>Aucun BC trouvé.</div>
          )}
          {filtered.map((bc) => (
            <button
              key={bc.id}
              onClick={() => onSelect(bc.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 20px', background: selected === bc.id ? '#eff6ff' : 'none',
                border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.1s',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{bc.numero}</div>
                {bc.client && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 1 }}>{bc.client.name}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{bc.rapport_b_cs_count} rapport{bc.rapport_b_cs_count !== 1 ? 's' : ''}</span>
                {selected === bc.id && <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RapportBCListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const statutFilter = searchParams.get('statut') ?? ''

  const [showCreate, setShowCreate] = useState(false)
  const [newTitre, setNewTitre] = useState('')
  const [newBcId, setNewBcId] = useState<number | ''>('')
  const [showBcPicker, setShowBcPicker] = useState(false)

  // Fetch all rapports without filter (for stats)
  const { data: allRapports = [] } = useQuery({
    queryKey: ['rapport-bc-list-all'],
    queryFn: () => rapportBCApi.list(),
    staleTime: 15_000,
  })

  // Fetch filtered rapports for the list
  const { data: rapports = [], isLoading } = useQuery({
    queryKey: ['rapport-bc-list-filtered', q, statutFilter],
    queryFn: () => rapportBCApi.list({ q: q || undefined, statut: statutFilter || undefined }),
    staleTime: 15_000,
  })

  const { data: bcs = [] } = useQuery({
    queryKey: ['rapport-bc-bcs'],
    queryFn: () => rapportBCApi.listBCs(),
    staleTime: 60_000,
  })

  // Stats computed from all rapports
  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of allRapports) {
      counts[r.statut] = (counts[r.statut] ?? 0) + 1
    }
    return {
      total: allRapports.length,
      brouillon: counts['brouillon'] ?? 0,
      preliminaire: counts['preliminaire'] ?? 0,
      valide: counts['valide'] ?? 0,
      archive: counts['archive'] ?? 0,
    }
  }, [allRapports])

  const selectedBc = bcs.find((bc) => bc.id === newBcId)

  const createMut = useMutation({
    mutationFn: () => rapportBCApi.create(Number(newBcId), { titre: newTitre || undefined }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc-list-all'] })
      void qc.invalidateQueries({ queryKey: ['rapport-bc-list-filtered'] })
      void qc.invalidateQueries({ queryKey: ['rapport-bc-bcs'] })
      setShowCreate(false)
      setNewTitre('')
      setNewBcId('')
      navigate(`/rapport-bc/${created.id}`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => rapportBCApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc-list-all'] })
      void qc.invalidateQueries({ queryKey: ['rapport-bc-list-filtered'] })
    },
  })

  const setQ = (val: string) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('q', val); else next.delete('q')
    setSearchParams(next, { replace: true })
  }
  const setTab = (val: string) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('statut', val); else next.delete('statut')
    next.delete('q')
    setSearchParams(next, { replace: true })
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Rapports de mission</h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
        >
          + Nouveau rapport
        </button>
      </div>

      {/* Cartes de stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { key: '', label: 'Total', count: stats.total, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
          { key: 'preliminaire', label: 'En attente', count: stats.preliminaire, color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
          { key: 'brouillon', label: 'Brouillons', count: stats.brouillon, color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
          { key: 'valide', label: 'Validés', count: stats.valide, color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7' },
          { key: 'archive', label: 'Archivés', count: stats.archive, color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            style={{
              padding: '14px 16px', borderRadius: 10, border: `1px solid ${statutFilter === s.key ? s.color : s.border}`,
              background: statutFilter === s.key ? s.bg : '#fff',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              boxShadow: statutFilter === s.key ? `0 0 0 2px ${s.color}22` : 'none',
            }}
          >
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e5e7eb', marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map((tab) => {
          const isActive = statutFilter === tab.key
          const count = tab.key === '' ? stats.total
            : tab.key === 'preliminaire' ? stats.preliminaire
            : tab.key === 'brouillon' ? stats.brouillon
            : tab.key === 'valide' ? stats.valide
            : tab.key === 'archive' ? stats.archive : 0
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              style={{
                padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: isActive ? 700 : 500, fontSize: '0.85rem',
                color: isActive ? '#2563eb' : '#6b7280',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -2, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                  background: tab.key === 'preliminaire' ? '#fef3c7' : '#f3f4f6',
                  color: tab.key === 'preliminaire' ? '#b45309' : '#6b7280',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Barre de recherche */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Rechercher par numéro, titre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
          {q && (
            <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>✕</button>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 6 }}>
          {rapports.length} résultat{rapports.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal création */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 500, boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
            <h2 style={{ margin: '0 0 18px', fontSize: '1.1rem', fontWeight: 700 }}>Nouveau rapport</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Sélecteur BC */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Bon de commande <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowBcPicker(true)}
                  style={{
                    width: '100%', padding: '10px 14px', border: `1px solid ${newBcId ? '#2563eb' : '#d1d5db'}`,
                    borderRadius: 7, background: newBcId ? '#eff6ff' : '#fafafa',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  {selectedBc ? (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{selectedBc.numero}</div>
                      {selectedBc.client && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{selectedBc.client.name}</div>}
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '0.88rem' }}>Cliquer pour sélectionner un BC…</span>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </button>
              </div>
              {/* Titre */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Nom du rapport
                </label>
                <input
                  type="text"
                  placeholder="Titre (optionnel)"
                  value={newTitre}
                  onChange={(e) => setNewTitre(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f9fafb', borderRadius: 6, padding: '8px 12px' }}>
                Créé par : <strong>{user?.name ?? '—'}</strong> · Date : <strong>{new Date().toLocaleDateString('fr-FR')}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreate(false); setNewTitre(''); setNewBcId('') }}
                style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}
              >
                Annuler
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !newBcId}
                style={{ padding: '8px 20px', background: newBcId ? '#2563eb' : '#93c5fd', color: '#fff', border: 'none', borderRadius: 7, cursor: newBcId ? 'pointer' : 'default', fontWeight: 700 }}
              >
                {createMut.isPending ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal BC picker */}
      {showBcPicker && (
        <BcPickerModal
          bcs={bcs}
          selected={newBcId}
          onSelect={(id) => { setNewBcId(id); setShowBcPicker(false) }}
          onClose={() => setShowBcPicker(false)}
        />
      )}

      {/* Liste */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Chargement…</div>
      )}
      {!isLoading && rapports.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
          {q || statutFilter ? 'Aucun rapport trouvé pour ces critères.' : "Aucun rapport créé pour l'instant."}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rapports.map((r: RapportBC) => (
          <div
            key={r.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', border: '1px solid #e5e7eb', borderRadius: 10,
              background: '#fff', gap: 12,
            }}
          >
            <button
              onClick={() => navigate(`/rapport-bc/${r.id}`)}
              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{r.numero}</span>
                {r.titre && <span style={{ fontSize: '0.88rem', color: '#374151' }}>{r.titre}</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {r.bon_commande && <span>BC : {r.bon_commande.numero}</span>}
                {r.created_by && <span>Par {r.created_by.name}</span>}
                <span>{formatAppDate(r.created_at)}</span>
                {r.taches_count != null && r.taches_count > 0 && <span>{r.taches_count} tâche{r.taches_count !== 1 ? 's' : ''}</span>}
                {r.latest_version && <span>v{r.latest_version.version_number}</span>}
              </div>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatutBadge statut={r.statut} />
              <button
                onClick={() => navigate(`/rapport-bc/${r.id}`)}
                style={{ padding: '5px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Ouvrir
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Supprimer ${r.numero} ?`)) deleteMut.mutate(r.id)
                }}
                style={{ padding: '5px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                title="Supprimer"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
