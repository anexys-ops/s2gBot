import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { planningApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { dateInputFromApi } from '../../lib/appLocale'

function ymdLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthRange(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  return { from: ymdLocal(first), to: ymdLocal(last), label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    tache: 'Tâche', terrain_bc: 'Terrain BC', utilisation: 'Utilisation matériel',
    conge: 'Congé', maladie: 'Maladie', formation: 'Formation', absent: 'Absence',
    maintenance: 'Maintenance', panne: 'Panne', calibration: 'Étalonnage', indispo: 'Indisponibilité',
    utilisation_chantier: 'Affectation chantier', etalonnage: 'Étalonnage', verification: 'Vérification',
  }
  return labels[type] ?? type
}

export default function PlanningGlobalPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [userFilter, setUserFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const { from, to, label } = monthRange(year, month)

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['planning-overview', from, to],
    queryFn: () => planningApi.overview(from, to),
    staleTime: 30_000,
  })

  const events = overview?.events ?? []
  const users = useMemo(() => [...new Map(events.filter((e) => e.user).map((e) => [e.user!.id, e.user!.name])).entries()], [events])
  const equipments = useMemo(() => [...new Map(events.filter((e) => e.equipment).map((e) => [e.equipment!.id, e.equipment!.name])).entries()], [events])
  const types = useMemo(() => [...new Set(events.map((e) => e.type_evenement))].sort(), [events])
  const filtered = events.filter((event) =>
    (!userFilter || event.user_id === Number(userFilter))
    && (!equipmentFilter || event.equipment_id === Number(equipmentFilter))
    && (!eventFilter || event.type_evenement === eventFilter))

  function changeMonth(amount: number) {
    const next = new Date(year, month + amount, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Planification' }]}
      moduleBarLabel="Planification"
      title="Planning global"
      subtitle="Personnes, matériel et événements liés dans un seul tableau."
      actions={<div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeMonth(-1)}>‹</button>
        <strong style={{ minWidth: 140, textAlign: 'center' }}>{label}</strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeMonth(1)}>›</button>
      </div>}
    >
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label>Utilisateur <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">Tous</option>
            {users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>Matériel <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
            <option value="">Tout</option>
            {equipments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>Événement <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="">Tous</option>
            {types.map((type) => <option key={type} value={type}>{eventLabel(type)}</option>)}
          </select></label>
        </div>
      </div>

      {isLoading ? <p className="text-muted">Chargement…</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}
      {!isLoading && !error ? (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead><tr><th>Période</th><th>Utilisateur</th><th>Matériel</th><th>Événement</th><th>Tâche / document</th><th>Notes</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={6} className="text-muted">Aucun événement pour cette période et ces filtres.</td></tr> : null}
              {filtered.map((event) => {
                const line = event.mission_task?.ordre_mission_ligne
                const om = line?.ordre_mission
                const bc = event.bon_commande_ligne?.bon_commande
                return <tr key={event.id}>
                  <td>{dateInputFromApi(event.date_debut)} → {dateInputFromApi(event.date_fin)}</td>
                  <td>{event.user?.name ?? '—'}</td>
                  <td>{event.equipment ? <Link to={`/materiel/equipements/${event.equipment.id}`}>{event.equipment.code ? `${event.equipment.code} — ` : ''}{event.equipment.name}</Link> : '—'}</td>
                  <td>{eventLabel(event.type_evenement)}</td>
                  <td>
                    {om ? <><Link to={`/ordres-mission/${om.id}`}>{om.numero}</Link> — {line?.libelle}</> : null}
                    {!om && bc ? <><Link to={`/bons-commande/${bc.id}`}>{bc.numero}</Link> — {event.bon_commande_ligne?.libelle}</> : null}
                    {!om && !bc && event.ordre_mission_id ? <Link to={`/ordres-mission/${event.ordre_mission_id}`}>Voir l’OM</Link> : null}
                    {!om && !bc && !event.ordre_mission_id && event.dossier_id ? <Link to={`/dossiers/${event.dossier_id}`}>Voir le dossier</Link> : null}
                    {!om && !bc && !event.ordre_mission_id && !event.dossier_id ? '—' : null}
                  </td>
                  <td>{event.notes ?? '—'}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </ModuleEntityShell>
  )
}
