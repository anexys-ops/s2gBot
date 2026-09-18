import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rapportBCApi, type RapportBCBonCommande, type RapportBC } from '../../api/client'
import { formatAppDate } from '../../lib/appLocale'

const STATUT_META: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:    { label: 'Brouillon',    color: '#6b7280', bg: '#f3f4f6' },
  preliminaire: { label: 'Préliminaire', color: '#f59e0b', bg: '#fef3c7' },
  valide:       { label: 'Validé',       color: '#10b981', bg: '#d1fae5' },
  archive:      { label: 'Archivé',      color: '#8b5cf6', bg: '#ede9fe' },
}

function StatutBadge({ statut }: { statut: string }) {
  const meta = STATUT_META[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  )
}

export default function RapportBCListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedBcId, setSelectedBcId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitre, setNewTitre] = useState('')

  const { data: bcs = [], isLoading: loadingBcs } = useQuery({
    queryKey: ['rapport-bc-bcs'],
    queryFn: () => rapportBCApi.listBCs(),
    staleTime: 30_000,
  })

  const { data: rapports = [], isLoading: loadingRapports } = useQuery({
    queryKey: ['rapport-bc-list', selectedBcId],
    queryFn: () => rapportBCApi.listByBc(selectedBcId!),
    enabled: selectedBcId !== null,
    staleTime: 15_000,
  })

  const createMut = useMutation({
    mutationFn: () => rapportBCApi.create(selectedBcId!, { titre: newTitre || undefined }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['rapport-bc-list'] })
      void qc.invalidateQueries({ queryKey: ['rapport-bc-bcs'] })
      setCreating(false)
      setNewTitre('')
      navigate(`/rapport-bc/${created.id}`)
    },
  })

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 0 }}>
      {/* Colonne BCs */}
      <div style={{ width: 320, borderRight: '1px solid #e5e7eb', overflowY: 'auto', background: '#fafafa' }}>
        <div style={{ padding: '16px 16px 8px', fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          Bons de commande
        </div>
        {loadingBcs && <div style={{ padding: 16, color: '#6b7280' }}>Chargement…</div>}
        {bcs.map((bc: RapportBCBonCommande) => (
          <button
            key={bc.id}
            onClick={() => setSelectedBcId(bc.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 16px',
              border: 'none',
              borderBottom: '1px solid #e5e7eb',
              background: selectedBcId === bc.id ? '#eff6ff' : 'transparent',
              cursor: 'pointer',
              outline: selectedBcId === bc.id ? '2px solid #3b82f6' : 'none',
              outlineOffset: -2,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bc.numero}</div>
            {bc.client && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{bc.client.name}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                {bc.finished_tasks_count} tâche{bc.finished_tasks_count !== 1 ? 's' : ''} terminée{bc.finished_tasks_count !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3b82f6' }}>
                {bc.rapport_b_cs_count} rapport{bc.rapport_b_cs_count !== 1 ? 's' : ''}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Colonne rapports */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {selectedBcId === null ? (
          <div style={{ color: '#9ca3af', marginTop: 40, textAlign: 'center' }}>
            Sélectionnez un bon de commande pour voir ses rapports.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                Rapports — BC #{bcs.find((b) => b.id === selectedBcId)?.numero ?? selectedBcId}
              </h2>
              <button
                onClick={() => setCreating(true)}
                style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
              >
                + Nouveau rapport
              </button>
            </div>

            {creating && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Nouveau rapport</div>
                <input
                  type="text"
                  placeholder="Titre du rapport (optionnel)"
                  value={newTitre}
                  onChange={(e) => setNewTitre(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') createMut.mutate() }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => createMut.mutate()}
                    disabled={createMut.isPending}
                    style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {createMut.isPending ? 'Création…' : 'Créer'}
                  </button>
                  <button onClick={() => { setCreating(false); setNewTitre('') }} style={{ padding: '6px 14px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {loadingRapports && <div style={{ color: '#6b7280' }}>Chargement…</div>}

            {!loadingRapports && rapports.length === 0 && (
              <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>
                Aucun rapport pour ce BC.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rapports.map((r: RapportBC) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/rapport-bc/${r.id}`)}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.numero}</div>
                    {r.titre && <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 2 }}>{r.titre}</div>}
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
                      Créé le {formatAppDate(r.created_at)}
                      {r.created_by ? ` par ${r.created_by.name}` : ''}
                      {r.latest_version ? ` · v${r.latest_version.version_number}` : ''}
                    </div>
                  </div>
                  <StatutBadge statut={r.statut} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
