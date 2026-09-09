/**
 * OrdresMissionPage
 *
 * Tableau de bord des ordres de mission (labo / technicien / ingénieur).
 * Génération depuis un bon de commande.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, ordresMissionApi, type OrdreMission } from '../../api/client'
import ClickableStatusBadge from '../../components/ds/ClickableStatusBadge'
import StatusBadge, { ordreMissionStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import StatusChangeModal from '../../components/StatusChangeModal'
import { useAuth } from '../../contexts/AuthContext'
import { ordreMissionBonCommande, ordreMissionQuote } from '../../lib/ordreMissionDisplay'

const TYPE_ORDER = ['technicien', 'labo', 'ingenieur'] as const
type OmType = (typeof TYPE_ORDER)[number]

const TYPE_META: Record<OmType, { label: string; color: string; bg: string; short: string }> = {
  technicien: { label: 'Techniciens (terrain)', color: '#f59e0b', bg: '#fef3c7', short: 'Terrain' },
  labo:       { label: 'Laboratoire', color: '#10b981', bg: '#d1fae5', short: 'Labo' },
  ingenieur:  { label: 'Ingénieurs', color: '#3b82f6', bg: '#dbeafe', short: 'Ingénierie' },
}

const CONTEXT_META: Record<string, { moduleBar: string; subtitle: string }> = {
  terrain: { moduleBar: 'Terrain — Ordres de mission', subtitle: 'Techniciens, laboratoire et ingénierie pour un même devis / BC.' },
  labo: { moduleBar: 'Laboratoire — Ordres de mission', subtitle: 'Techniciens, laboratoire et ingénierie pour un même devis / BC.' },
  ingenierie: { moduleBar: 'Ingénierie — Ordres de mission', subtitle: 'Techniciens, laboratoire et ingénierie pour un même devis / BC.' },
  default: { moduleBar: 'Ordres de mission', subtitle: 'Un OdM par type (terrain, labo, ingénieur) pour chaque bon de commande.' },
}

function parseOmType(value: string | null): OmType | '' {
  if (value === 'technicien' || value === 'labo' || value === 'ingenieur') return value
  return ''
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
  const meta =
    type in TYPE_META
      ? TYPE_META[type as OmType]
      : { label: type, color: '#6b7280', bg: '#f3f4f6', short: type }
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusModalOm, setStatusModalOm] = useState<{ id: number; numero: string; statut: string } | null>(null)
  const bcFilterFromUrl = searchParams.get('bon_commande_id')
  const contextFromUrl = searchParams.get('context') ?? 'default'
  const typeFromUrl = parseOmType(searchParams.get('type'))
  const [typeFilter, setTypeFilter] = useState<OmType | ''>(() => typeFromUrl)
  const [statutFilter, setStatutFilter] = useState('')

  useEffect(() => {
    setTypeFilter(typeFromUrl)
  }, [typeFromUrl])

  const contextMeta = CONTEXT_META[contextFromUrl] ?? CONTEXT_META.default

  function setTypeFilterAndUrl(next: OmType | '') {
    setTypeFilter(next)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) params.set('type', next)
      else params.delete('type')
      return params
    }, { replace: true })
  }
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

  const stats = TYPE_ORDER.map((type) => ({
    type,
    total: ordres.filter((o) => o.type === type).length,
    en_cours: ordres.filter((o) => o.type === type && o.statut === 'en_cours').length,
  }))

  const displayedOrdres = useMemo(() => {
    const list = typeFilter ? ordres.filter((o) => o.type === typeFilter) : ordres
    return [...list].sort((a, b) => {
      const bcA = ordreMissionBonCommande(a)?.numero ?? ''
      const bcB = ordreMissionBonCommande(b)?.numero ?? ''
      if (bcA !== bcB) return bcB.localeCompare(bcA, 'fr')
      const typeIdx = (t: string) => TYPE_ORDER.indexOf(t as OmType)
      return typeIdx(a.type) - typeIdx(b.type)
    })
  }, [ordres, typeFilter])

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Ordres de mission' }]}
      moduleBarLabel={contextMeta.moduleBar}
      title="Ordres de mission"
      subtitle={
        bcFilterFromUrl
          ? `${displayedOrdres.length} ordre(s) pour le BC #${bcFilterFromUrl} — ${contextMeta.subtitle}`
          : `${displayedOrdres.length} ordre(s) affiché(s) — ${contextMeta.subtitle}`
      }
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowGeneratePanel((v) => !v)}>
          ⚡ Générer depuis BC
        </button>
      }
    >
      {/* 3 sections OdM (terrain / labo / ingénieur) — un OdM par type pour le même devis */}
      <div className="odm-type-sections" role="tablist" aria-label="Types d'ordres de mission">
        {stats.map(({ type, total, en_cours }) => {
          const meta = TYPE_META[type]
          const active = typeFilter === type
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={active}
              className={`odm-type-sections__card${active ? ' is-active' : ''}`}
              style={{ ['--odm-type-color' as string]: meta.color, ['--odm-type-bg' as string]: meta.bg }}
              onClick={() => setTypeFilterAndUrl(active ? '' : type)}
            >
              <div className="odm-type-sections__count">{total}</div>
              <div className="odm-type-sections__label">{meta.label}</div>
              {en_cours > 0 && <div className="odm-type-sections__sub">{en_cours} en cours</div>}
            </button>
          )
        })}
      </div>

      {/* Génération depuis BC */}
      {showGeneratePanel && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>Générer depuis un bon de commande</h4>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Un OdM est créé par type (terrain, labo, ingénieur) pour le même devis / BC. Les tâches sont générées
            à partir des sous-produits du catalogue (sections OdM) et de leurs actions ; vous pourrez ensuite
            affecter, planifier les dates et faire évoluer les statuts.
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
        <select value={typeFilter} onChange={(e) => setTypeFilterAndUrl(parseOmType(e.target.value || null))} style={{ flex: '1 1 160px', maxWidth: 220 }}>
          <option value="">— Les 3 types —</option>
          {TYPE_ORDER.map((v) => <option key={v} value={v}>{TYPE_META[v].label}</option>)}
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
                {displayedOrdres.map((om) => {
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
          {displayedOrdres.length === 0 && <p style={{ padding: '1rem' }} className="text-muted">Aucun ordre de mission.</p>}
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
