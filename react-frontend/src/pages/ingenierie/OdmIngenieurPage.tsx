/**
 * OdmIngenieurPage
 *
 * Vue des Ordres de Mission de type "ingenieur" pour les ingénieurs.
 * Permet de prendre en charge et terminer les OdMs.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordresMissionApi, type OrdreMission, type OrdreMissionLigne } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const STATUT_META: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon',  color: '#6b7280', bg: '#f3f4f6' },
  planifie:  { label: 'Planifié',   color: '#8b5cf6', bg: '#ede9fe' },
  en_cours:  { label: 'En cours',   color: '#3b82f6', bg: '#dbeafe' },
  termine:   { label: 'Terminé',    color: '#10b981', bg: '#d1fae5' },
  annule:    { label: 'Annulé',     color: '#ef4444', bg: '#fee2e2' },
}

const LIGNE_STATUT_META: Record<string, { label: string; color: string }> = {
  a_faire:  { label: 'À faire',   color: '#6b7280' },
  en_cours: { label: 'En cours',  color: '#3b82f6' },
  realise:  { label: 'Réalisé',   color: '#10b981' },
  annule:   { label: 'Annulé',    color: '#ef4444' },
}

function StatutBadge({ statut }: { statut: string }) {
  const meta = STATUT_META[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span
      style={{
        padding: '0.15rem 0.55rem',
        borderRadius: 12,
        fontSize: '0.78rem',
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  )
}

function LignesRow({ om }: { om: OrdreMission }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['ordres-mission', om.id, 'detail'],
    queryFn: () => ordresMissionApi.get(om.id),
    staleTime: 60_000,
  })

  const lignes: OrdreMissionLigne[] = detail?.lignes ?? om.lignes ?? []

  if (isLoading) {
    return (
      <tr>
        <td colSpan={7} style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.85rem' }}>
          Chargement des lignes…
        </td>
      </tr>
    )
  }

  if (!lignes.length) {
    return (
      <tr>
        <td colSpan={7} style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.85rem' }}>
          Aucune prestation renseignée.
        </td>
      </tr>
    )
  }

  return (
    <>
      {lignes.map((ligne) => {
        const ligneStatut = LIGNE_STATUT_META[ligne.statut] ?? { label: ligne.statut, color: '#6b7280' }
        return (
          <tr key={ligne.id} style={{ background: '#f9fafb' }}>
            <td />
            <td colSpan={2} style={{ paddingLeft: '2rem', fontSize: '0.85rem', color: '#374151' }}>
              {ligne.libelle}
              {ligne.article && (
                <span style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                  [{ligne.article.code}]
                </span>
              )}
            </td>
            <td style={{ fontSize: '0.85rem' }}>{ligne.quantite}</td>
            <td style={{ fontSize: '0.85rem' }}>
              <span style={{ color: ligneStatut.color, fontWeight: 600 }}>{ligneStatut.label}</span>
            </td>
            <td style={{ fontSize: '0.85rem' }}>{ligne.assignedUser?.name ?? '—'}</td>
            <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{ligne.notes ?? '—'}</td>
          </tr>
        )
      })}
    </>
  )
}

export default function OdmIngenieurPage() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const [statutFilter, setStatutFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const { data: ordres = [], isLoading } = useQuery({
    queryKey: ['ordres-mission', 'ingenieur', statutFilter],
    queryFn: () =>
      ordresMissionApi.list({
        type: 'ingenieur',
        statut: statutFilter || undefined,
      }),
    staleTime: 30_000,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<OrdreMission> }) =>
      ordresMissionApi.update(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ordres-mission', 'ingenieur'] }),
  })

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handlePrendreEnCharge(om: OrdreMission) {
    if (!user) return
    updateMut.mutate({
      id: om.id,
      body: { statut: 'en_cours', responsable_id: user.id },
    })
  }

  function handleTerminer(om: OrdreMission) {
    if (!window.confirm(`Marquer l'OdM ${om.numero} comme terminé ?`)) return
    updateMut.mutate({ id: om.id, body: { statut: 'termine' } })
  }

  // Filtrage côté client par BC, site ou client
  const filtered = ordres.filter((om) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      om.bonCommande?.numero?.toLowerCase().includes(q) ||
      om.site?.name?.toLowerCase().includes(q) ||
      om.client?.name?.toLowerCase().includes(q) ||
      om.numero?.toLowerCase().includes(q)
    )
  })

  // Compteurs
  const countEnAttente = ordres.filter((o) => o.statut === 'brouillon' || o.statut === 'planifie').length
  const countEnCours   = ordres.filter((o) => o.statut === 'en_cours').length
  const countTermine   = ordres.filter((o) => o.statut === 'termine').length

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Ingénierie', to: '/ingenierie' },
        { label: 'Ordres de Mission' },
      ]}
      moduleBarLabel="Ingénierie — Ordres de Mission"
      title="Ordres de Mission — Ingénierie"
      subtitle={`${filtered.length} OdM affiché(s)`}
    >
      {/* Compteurs */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {[
          { label: 'En attente', value: countEnAttente, color: '#d97706', bg: '#fef3c7' },
          { label: 'En cours',   value: countEnCours,   color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Terminés',   value: countTermine,   color: '#10b981', bg: '#d1fae5' },
        ].map(({ label, value, color, bg }) => (
          <div
            key={label}
            style={{
              flex: '1 1 130px',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: bg,
            }}
          >
            <div style={{ fontWeight: 700, color, fontSize: '1.4rem' }}>{value}</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Rechercher BC, site, client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', maxWidth: 320 }}
        />
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          style={{ flex: '1 1 160px', maxWidth: 200 }}
        >
          <option value="">— Tous statuts —</option>
          {Object.entries(STATUT_META).map(([v, m]) => (
            <option key={v} value={v}>{m.label}</option>
          ))}
        </select>
        {(statutFilter || search) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => { setStatutFilter(''); setSearch('') }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      {isLoading && <p>Chargement…</p>}
      {!isLoading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>Numéro</th>
                  <th>BC / Client</th>
                  <th>Prestations</th>
                  <th>Statut</th>
                  <th>Assigné</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                      Aucun OdM ingénierie en attente.
                    </td>
                  </tr>
                )}
                {filtered.map((om) => {
                  const isExpanded = expandedIds.has(om.id)
                  const lignesCount = om.lignes?.length ?? 0
                  const isPending = updateMut.isPending && (updateMut.variables as any)?.id === om.id

                  return (
                    <>
                      <tr key={om.id}>
                        {/* Expand toggle */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', lineHeight: 1 }}
                            onClick={() => toggleExpand(om.id)}
                            title={isExpanded ? 'Masquer les prestations' : 'Voir les prestations'}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>

                        {/* Numéro */}
                        <td>
                          <Link to={`/ordres-mission/${om.id}`} className="link-inline" style={{ fontWeight: 600 }}>
                            {om.numero}
                          </Link>
                          {om.date_prevue && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {new Date(om.date_prevue).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </td>

                        {/* BC / Client */}
                        <td>
                          {om.bonCommande ? (
                            <Link to={`/bons-commande/${om.bon_commande_id}`} className="link-inline">
                              {om.bonCommande.numero}
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            {om.client?.name ?? ''}
                            {om.site?.name ? ` · ${om.site.name}` : ''}
                          </div>
                        </td>

                        {/* Prestations */}
                        <td>
                          <span style={{ fontWeight: 600 }}>{lignesCount}</span>
                          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}> prestation(s)</span>
                        </td>

                        {/* Statut */}
                        <td><StatutBadge statut={om.statut} /></td>

                        {/* Assigné */}
                        <td style={{ fontSize: '0.88rem' }}>
                          {om.responsable?.name ?? <span className="text-muted">—</span>}
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="crud-actions">
                            {(om.statut === 'brouillon' || om.statut === 'planifie') && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={isPending}
                                onClick={() => handlePrendreEnCharge(om)}
                              >
                                {isPending ? '…' : 'Prendre en charge'}
                              </button>
                            )}
                            {om.statut === 'en_cours' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ borderColor: '#10b981', color: '#10b981' }}
                                disabled={isPending}
                                onClick={() => handleTerminer(om)}
                              >
                                {isPending ? '…' : 'Terminer'}
                              </button>
                            )}
                            <Link to={`/ordres-mission/${om.id}`} className="btn btn-secondary btn-sm">
                              Ouvrir
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {/* Lignes expandables */}
                      {isExpanded && <LignesRow om={om} />}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {updateMut.isError && (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          {(updateMut.error as Error).message}
        </p>
      )}
    </ModuleEntityShell>
  )
}
