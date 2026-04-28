/**
 * OrdresMissionPage
 *
 * Tableau de bord des ordres de mission (labo / technicien / ingénieur).
 * Génération depuis un bon de commande.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, ordresMissionApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

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
  const [typeFilter, setTypeFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [generateBcId, setGenerateBcId] = useState<number | ''>('')
  const [showGeneratePanel, setShowGeneratePanel] = useState(false)

  const { data: ordres = [], isLoading } = useQuery({
    queryKey: ['ordres-mission', typeFilter, statutFilter],
    queryFn: () => ordresMissionApi.list({ type: typeFilter || undefined, statut: statutFilter || undefined }),
    staleTime: 30_000,
  })

  const { data: bonsCommande = [] } = useQuery({
    queryKey: ['bons-commande', 'for-om'],
    queryFn: () => bonsCommandeApi.list({ statut: 'confirme' }),
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
      setShowGeneratePanel(false)
      setGenerateBcId('')
      alert(`${created.length} ordre(s) de mission générés.`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => ordresMissionApi.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ordres-mission'] }),
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
      subtitle={`${ordres.length} ordre(s) affiché(s)`}
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
            Les OMs labo / technicien / ingénieur seront créés selon les actions définies sur chaque article du BC.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 280px' }}>
              Bon de commande (confirmé)
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
                  <th>Numéro</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>BC</th>
                  <th>Statut</th>
                  <th>Date prévue</th>
                  <th>Responsable</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordres.map((om) => (
                  <tr key={om.id}>
                    <td><Link to={`/ordres-mission/${om.id}`} className="link-inline" style={{ fontWeight: 600 }}>{om.numero}</Link></td>
                    <td><TypeBadge type={om.type} /></td>
                    <td>{om.client?.name ?? `#${om.client_id}`}</td>
                    <td>{om.bonCommande && <Link to={`/bons-commande/${om.bon_commande_id}`} className="link-inline">{om.bonCommande.numero}</Link>}</td>
                    <td><span className="badge">{STATUT_META[om.statut] ?? om.statut}</span></td>
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
                ))}
              </tbody>
            </table>
          </div>
          {ordres.length === 0 && <p style={{ padding: '1rem' }} className="text-muted">Aucun ordre de mission.</p>}
        </div>
      )}
    </ModuleEntityShell>
  )
}
