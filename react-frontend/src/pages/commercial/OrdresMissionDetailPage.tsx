import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { missionsApi, planningTerrainApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function OrdresMissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const missionId = Number(id)
  const [selectedTechId, setSelectedTechId] = useState<number | ''>('')

  const { data: mission, isLoading } = useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => missionsApi.get(missionId),
    enabled: Number.isFinite(missionId) && missionId > 0,
  })

  const bcId = mission?.bon_commande_id ?? null

  const { data: techniciens = [] } = useQuery({
    queryKey: ['planning-terrain', 'techniciens'],
    queryFn: () => planningTerrainApi.techniciens(),
  })

  const { data: affectations = [] } = useQuery({
    queryKey: ['planning-terrain', 'mission', bcId],
    queryFn: () => planningTerrainApi.list({ from: '2000-01-01', to: '2100-12-31', user_id: undefined }),
    enabled: !!bcId,
  })

  // filter affectations that belong to this BC
  const bcAffectations = useMemo(() => {
    if (!bcId) return []
    return affectations.filter((a) => {
      const lineId = (a as any).bon_commande_ligne?.bon_commande_id
      return lineId === bcId
    })
  }, [affectations, bcId])

  const filtered = useMemo(() => {
    if (!selectedTechId) return bcAffectations
    return bcAffectations.filter((a) => a.user_id === selectedTechId)
  }, [bcAffectations, selectedTechId])

  const uniqueTechs = useMemo(() => {
    const ids = new Set(bcAffectations.map((a) => a.user_id))
    return techniciens.filter((t) => ids.has(t.id))
  }, [bcAffectations, techniciens])

  if (!Number.isFinite(missionId) || missionId <= 0) return <p className="error">Identifiant invalide.</p>

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Ordres de mission', to: '/ordres-mission' },
        { label: isLoading ? '…' : (mission?.reference ?? `#${missionId}`) },
      ]}
      moduleBarLabel="Commercial"
      title={isLoading ? 'Chargement…' : `Ordre de mission ${mission?.reference ?? ''}`}
      subtitle={mission?.title}
      actions={
        <div className="crud-actions no-print">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
            ← Retour
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            🖨 Imprimer / PDF
          </button>
        </div>
      }
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .app-header, .app-context-bar, .breadcrumb, .module-bar { display: none !important; }
          body { font-size: 11pt; }
          .print-header { display: flex !important; }
        }
        .print-header { display: none; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
      `}</style>

      {/* En-tête visible uniquement à l'impression */}
      <div className="print-header">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>ORDRE DE MISSION</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>{mission?.reference}</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
          <div><strong>Date :</strong> {new Date().toLocaleDateString('fr-FR')}</div>
          {mission?.mission_status && <div><strong>Statut :</strong> {mission.mission_status.toUpperCase()}</div>}
        </div>
      </div>

      {/* Infos mission */}
      {mission && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <tbody>
                <tr><th style={{ width: 160 }}>Référence</th><td><code>{mission.reference}</code></td></tr>
                <tr><th>Titre</th><td>{mission.title || '—'}</td></tr>
                <tr><th>Statut</th><td><span className="dossier-badge dossier-badge--cours">{mission.mission_status ?? '—'}</span></td></tr>
                <tr>
                  <th>Source</th>
                  <td>
                    {mission.bon_commande_id ? (
                      <Link to={`/bons-commande/${mission.bon_commande_id}`} className="link-inline">
                        BC #{mission.bon_commande_id}
                      </Link>
                    ) : mission.dossier_id ? (
                      <Link to={`/dossiers/${mission.dossier_id}`} className="link-inline">
                        Dossier #{mission.dossier_id}
                      </Link>
                    ) : '—'}
                  </td>
                </tr>
                {mission.site && <tr><th>Chantier</th><td>{mission.site.name}</td></tr>}
                {mission.notes && <tr><th>Notes</th><td>{mission.notes}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sélecteur technicien (masqué à l'impression) */}
      {uniqueTechs.length > 0 && (
        <div className="card no-print" style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Imprimer pour :</span>
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value ? Number(e.target.value) : '')}
              style={{ minWidth: 200 }}
            >
              <option value="">Tous les techniciens</option>
              {uniqueTechs.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <p className="text-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.82rem' }}>
            Sélectionnez un technicien pour imprimer uniquement ses tâches.
          </p>
        </div>
      )}

      {/* Tableau des affectations */}
      <h2 className="h2" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
        Tâches {selectedTechId ? `— ${techniciens.find((t) => t.id === selectedTechId)?.name ?? ''}` : ''}
      </h2>

      {!filtered.length && (
        <p className="text-muted">
          {!bcId ? 'Cet ordre de mission n\'est pas lié à un bon de commande.' : 'Aucune affectation planifiée.'}
        </p>
      )}

      {!!filtered.length && (
        <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Libellé / Tâche</th>
                <th>Technicien</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((aff) => (
                <tr key={aff.id}>
                  <td>{(aff as any).bon_commande_ligne?.libelle ?? '—'}</td>
                  <td>{aff.user?.name ?? techniciens.find((t) => t.id === aff.user_id)?.name ?? '—'}</td>
                  <td>{String(aff.date_debut).slice(0, 10)}</td>
                  <td>{String(aff.date_fin).slice(0, 10)}</td>
                  <td>{aff.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Planning linéaire (visible à l'impression) */}
      {!!filtered.length && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Planning</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map((aff) => {
              const debut = new Date(String(aff.date_debut).slice(0, 10))
              const fin = new Date(String(aff.date_fin).slice(0, 10))
              const jours = Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 86_400_000) + 1)
              const tech = aff.user?.name ?? techniciens.find((t) => t.id === aff.user_id)?.name ?? '?'
              return (
                <div key={aff.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.88rem' }}>
                  <span style={{ minWidth: 150, fontWeight: 500 }}>{tech}</span>
                  <span style={{ minWidth: 200, color: '#6b7280' }}>{(aff as any).bon_commande_ligne?.libelle ?? '—'}</span>
                  <span style={{
                    background: '#dbeafe', color: '#1d4ed8', borderRadius: 4,
                    padding: '0.2rem 0.75rem', fontSize: '0.82rem', whiteSpace: 'nowrap',
                  }}>
                    {debut.toLocaleDateString('fr-FR')} → {fin.toLocaleDateString('fr-FR')} ({jours}j)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </ModuleEntityShell>
  )
}
