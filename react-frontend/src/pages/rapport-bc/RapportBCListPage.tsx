import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rapportBCApi, type RapportBC } from '../../api/client'
import { formatAppDate } from '../../lib/appLocale'
import { useAuth } from '../../contexts/AuthContext'

const STATUT_META: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:    { label: 'Brouillon',    color: '#6b7280', bg: '#f3f4f6' },
  preliminaire: { label: 'Préliminaire', color: '#f59e0b', bg: '#fef3c7' },
  valide:       { label: 'Validé',       color: '#10b981', bg: '#d1fae5' },
  archive:      { label: 'Archivé',      color: '#8b5cf6', bg: '#ede9fe' },
}

function StatutBadge({ statut }: { statut: string }) {
  const meta = STATUT_META[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 12, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
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

  const { data: rapports = [], isLoading } = useQuery({
    queryKey: ['rapport-bc-list-all', q, statutFilter],
    queryFn: () => rapportBCApi.list({ q: q || undefined, statut: statutFilter || undefined }),
    staleTime: 15_000,
  })

  const { data: bcs = [] } = useQuery({
    queryKey: ['rapport-bc-bcs'],
    queryFn: () => rapportBCApi.listBCs(),
    staleTime: 60_000,
  })

  const { data: statuts = [] } = useQuery({
    queryKey: ['rapport-bc-statuts'],
    queryFn: () => rapportBCApi.statuts(),
    staleTime: 300_000,
  })

  const createMut = useMutation({
    mutationFn: () =>
      rapportBCApi.create(Number(newBcId), { titre: newTitre || undefined }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc-list-all'] })
      void qc.invalidateQueries({ queryKey: ['rapport-bc-bcs'] })
      setShowCreate(false)
      setNewTitre('')
      setNewBcId('')
      navigate(`/rapport-bc/${created.id}`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => rapportBCApi.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rapport-bc-list-all'] }),
  })

  const setQ = (val: string) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('q', val); else next.delete('q')
    setSearchParams(next, { replace: true })
  }
  const setStatut = (val: string) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('statut', val); else next.delete('statut')
    setSearchParams(next, { replace: true })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Rapports de mission</h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 2 }}>{rapports.length} rapport{rapports.length !== 1 ? 's' : ''}</div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
        >
          + Nouveau rapport
        </button>
      </div>

      {/* Barre de recherche + filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Rechercher par numéro ou titre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={statutFilter}
          onChange={(e) => setStatut(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.9rem', background: '#fff', minWidth: 140 }}
        >
          <option value="">Tous les statuts</option>
          {statuts.map((s) => (
            <option key={s} value={s}>{STATUT_META[s]?.label ?? s}</option>
          ))}
        </select>
      </div>

      {/* Modal création */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
            <h2 style={{ margin: '0 0 18px', fontSize: '1.1rem', fontWeight: 700 }}>Nouveau rapport</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Bon de commande <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={newBcId}
                  onChange={(e) => setNewBcId(e.target.value ? Number(e.target.value) : '')}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
                >
                  <option value="">— Sélectionner un BC —</option>
                  {bcs.map((bc) => (
                    <option key={bc.id} value={bc.id}>{bc.numero}{bc.client ? ` — ${bc.client.name}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Nom du rapport
                </label>
                <input
                  type="text"
                  placeholder="Titre (optionnel)"
                  value={newTitre}
                  onChange={(e) => setNewTitre(e.target.value)}
                  autoFocus
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
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
              background: '#fff', gap: 12, transition: 'box-shadow 0.15s',
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
                {r.taches_count != null && <span>{r.taches_count} tâche{r.taches_count !== 1 ? 's' : ''}</span>}
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
