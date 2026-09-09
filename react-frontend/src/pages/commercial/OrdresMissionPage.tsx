/**
 * OrdresMissionPage
 *
 * Tableau de bord des ordres de mission (labo / technicien / ingénieur).
 * Génération depuis un bon de commande.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, ordresMissionApi, type OrdreMission } from '../../api/client'
import ClickableStatusBadge from '../../components/ds/ClickableStatusBadge'
import StatusBadge, { ordreMissionStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import StatusChangeModal from '../../components/StatusChangeModal'
import { useAuth } from '../../contexts/AuthContext'
import { ordreMissionBonCommande, ordreMissionQuote } from '../../lib/ordreMissionDisplay'

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  labo:       { label: 'Laboratoire', color: '#10b981', bg: '#d1fae5' },
  technicien: { label: 'Techniciens', color: '#f59e0b', bg: '#fef3c7' },
  ingenieur:  { label: 'Ingénieurs',  color: '#3b82f6', bg: '#dbeafe' },
}

const STATUT_META: Record<string, string> = {
  brouillon: 'Brouillon',
  planifie:  'Planifié',
  en_cours:  'En cours',
  termine:   'Terminé',
  annule:    'Annulé',
}

const STATUTS = ['brouillon', 'planifie', 'en_cours', 'termine', 'annule'] as const

const statusOptions = STATUTS.map((value) => ({ value, label: STATUT_META[value] ?? value }))

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  )
}

export default function OrdresMissionPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [searchParams] = useSearchParams()
  const [statusModalOm, setStatusModalOm] = useState<{ id: number; numero: string; statut: string } | null>(null)
  const bcFilterFromUrl = searchParams.get('bon_commande_id')
  const [typeFilter, setTypeFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [generateBcId, setGenerateBcId] = useState<number | ''>(() =>
    bcFilterFromUrl && Number.isFinite(Number(bcFilterFromUrl)) ? Number(bcFilterFromUrl) : '',
  )
  const [showGeneratePanel, setShowGeneratePanel] = useState(false)

  const { data: ordres = [], isLoading } = useQuery({
    queryKey: ['ordres-mission', typeFilter, statutFilter, bcFilterFromUrl],
    queryFn: () =>
      ordresMissionApi.list({
        type: typeFilter || undefined,
        statut: statutFilter || undefined,
        bon_commande_id: bcFilterFromUrl ? Number(bcFilterFromUrl) : undefined,
      }),
    staleTime: 30_000,
  })

  const { data: bonsCommande = [] } = useQuery({
    queryKey: ['bons-commande', 'for-om'],
    queryFn: async () => {
      const [confirmes, enCours] = await Promise.all([
        bonsCommandeApi.list({ statut: 'confirme' }),
        bonsCommandeApi.list({ statut: 'en_cours' }),
      ])
      const byId = new Map<number, (typeof confirmes)[number]>()
      for (const bc of [...confirmes, ...enCours]) {
        byId.set(bc.id, bc)
      }
      return [...byId.values()].sort((a, b) => b.id - a.id)
    },
    enabled: showGeneratePanel,
    staleTime: 60_000,
  })

  const generateMut = useMutation({
    mutationFn: () => {
      if (!generateBcId) throw new Error('Sélectionnez un bon de commande.')
      return ordresMissionApi.generateFromBC(generateBcId as number)
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
      setShowGeneratePanel(false)
      setGenerateBcId('')
      alert(`${created.length} ordre(s) de mission générés (OdM, tâches terrain et planning).`)
    },
    onError: (err) => {
      alert((err as Error).message)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => ordresMissionApi.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ordres-mission'] }),
  })

  const updateStatutMut = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: OrdreMission['statut'] }) =>
      ordresMissionApi.update(id, { statut }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission', vars.id] })
      void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
      setStatusModalOm(null)
    },
  })

  const stats = Object.keys(TYPE_META).map((type) => ({
    type,
    total: ordres.filter((o) => o.type === type).length,
    en_cours: ordres.filter((o) => o.type === type && o.statut === 'en_cours').length,
  }))

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Ordres de mission' }]}
      moduleBarLabel="Commercial — Ordres de mission"
      title="Ordres de mission"
      subtitle={
        bcFilterFromUrl
          ? `${ordres.length} ordre(s) pour le BC #${bcFilterFromUrl}`
          : `${ordres.length} ordre(s) affiché(s)`
      }
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowGeneratePanel((v) => !v)}>
          ⚡ Générer depuis BC
        </button>
      }
    >
      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {stats.map(({ type, total, en_cours }) => {
          const meta = TYPE_META[type]
          return (
            <div
              key={type}
              style={{ flex: '1 1 150px', padding: '0.75rem 1rem', borderRadius: 8, background: meta.bg, cursor: 'pointer', border: typeFilter === type ? `2px solid ${meta.color}` : '2px solid transparent' }}
              onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
            >
              <div style={{ fontWeight: 700, color: meta.color, fontSize: '1.4rem' }}>{total}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{meta.label}</div>
              {en_cours > 0 && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{en_cours} en cours</div>}
            </div>
          )
        })}
      </div>

      {/* Génération depuis BC */}
      {showGeneratePanel && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>Générer depuis un bon de commande</h4>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Les OMs labo / technicien / ingénieur seront créés selon les actions catalogue, les déclencheurs OdM
            ou la planification terrain (technicien + dates) des lignes BC.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 280px' }}>
              Bon de commande (confirmé ou en cours)
              <select value={generateBcId} onChange={(e) => setGenerateBcId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Choisir…</option>
                {bonsCommande.map((bc) => (
                  <option key={bc.id} value={bc.id}>{bc.numero} — {bc.client?.name ?? `#${bc.client_id}`}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary" disabled={!generateBcId || generateMut.isPending} onClick={() => generateMut.mutate()}>
              {generateMut.isPending ? 'Génération…' : 'Générer les OMs'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowGeneratePanel(false)}>Annuler</button>
          </div>
          {generateMut.isError && <p className="error" style={{ marginTop: '0.5rem' }}>{(generateMut.error as Error).message}</p>}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ flex: '1 1 160px', maxWidth: 200 }}>
          <option value="">— Tous types —</option>
          {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} style={{ flex: '1 1 160px', maxWidth: 200 }}>
          <option value="">— Tous statuts —</option>
          {Object.entries(STATUT_META).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Link to="/ordres-mission/planning" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
          📅 Planning
        </Link>
      </div>

      {isLoading && <p>Chargement…</p>}
      {!isLoading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th className="data-table__code">Numéro OdM</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th className="data-table__code">Devis</th>
                  <th className="data-table__code">BC</th>
                  <th>Statut</th>
                  <th>Date prévue</th>
                  <th>Responsable</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordres.map((om) => {
                  const bc = ordreMissionBonCommande(om)
                  const quote = ordreMissionQuote(om)
                  const st = ordreMissionStatutBadgeProps(om.statut)
                  return (
                  <tr key={om.id}>
                    <td className="data-table__code"><Link to={`/ordres-mission/${om.id}`} className="link-inline" style={{ fontWeight: 600 }}>{om.numero}</Link></td>
                    <td><TypeBadge type={om.type} /></td>
                    <td>
                      {om.client_id ? (
                        <Link to={`/clients/${om.client_id}/fiche`} className="link-inline" onClick={(e) => e.stopPropagation()}>
                          {om.client?.name ?? `#${om.client_id}`}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="data-table__code">
                      {quote ? (
                        <Link to={`/devis/${quote.id}/editer`} className="link-inline" onClick={(e) => e.stopPropagation()}>
                          <code className="code-badge">{quote.number}</code>
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="data-table__code">
                      {bc ? (
                        <Link to={`/bons-commande/${bc.id}`} className="link-inline" onClick={(e) => e.stopPropagation()}>
                          <code className="code-badge">{bc.numero}</code>
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="data-table__status">
                      {isLab ? (
                        <ClickableStatusBadge
                          variant={st.variant}
                          size="sm"
                          ariaLabel={`Changer le statut de ${om.numero}`}
                          onClick={() => setStatusModalOm({ id: om.id, numero: om.numero, statut: om.statut })}
                        >
                          {st.label}
                        </ClickableStatusBadge>
                      ) : (
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                      )}
                    </td>
                    <td>{om.date_prevue ? new Date(om.date_prevue).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{om.responsable?.name ?? '—'}</td>
                    <td>
                      <div className="crud-actions">
                        <Link to={`/ordres-mission/${om.id}`} className="btn btn-secondary btn-sm">Ouvrir</Link>
                        <button type="button" className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => { if (window.confirm(`Supprimer ${om.numero} ?`)) deleteMut.mutate(om.id) }}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {ordres.length === 0 && <p style={{ padding: '1rem' }} className="text-muted">Aucun ordre de mission.</p>}
        </div>
      )}

      {statusModalOm !== null ? (
        <StatusChangeModal
          title={`Statut — ${statusModalOm.numero}`}
          initialValue={statusModalOm.statut}
          options={statusOptions}
          isPending={updateStatutMut.isPending}
          error={updateStatutMut.isError ? (updateStatutMut.error as Error).message : null}
          onClose={() => setStatusModalOm(null)}
          onSave={(statut) =>
            updateStatutMut.mutate({ id: statusModalOm.id, statut: statut as OrdreMission['statut'] })
          }
        />
      ) : null}
    </ModuleEntityShell>
  )
}
