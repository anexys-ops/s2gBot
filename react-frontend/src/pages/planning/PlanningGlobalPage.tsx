import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { planningApi, type PlanningEvent } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { dateInputFromApi } from '../../lib/appLocale'
import { eventStatus, matchesText, statusLabels, weekRange, type PlanningStatus } from './planningGlobalFilters'
import './PlanningGlobalPage.css'

const PAGE_SIZE = 25

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    tache: 'Tâche', terrain_bc: 'Terrain BC', utilisation: 'Utilisation matériel',
    conge: 'Congé', maladie: 'Maladie', formation: 'Formation', absent: 'Absence',
    maintenance: 'Maintenance', panne: 'Panne', calibration: 'Étalonnage', indispo: 'Indisponibilité',
    utilisation_chantier: 'Affectation chantier', etalonnage: 'Étalonnage', verification: 'Vérification',
  }
  return labels[type] ?? type
}

function taskDocumentText(event: PlanningEvent): string {
  const line = event.mission_task?.ordre_mission_ligne
  const om = line?.ordre_mission
  const bc = event.bon_commande_ligne?.bon_commande
  return [om?.numero, line?.libelle, bc?.numero, event.bon_commande_ligne?.libelle].filter(Boolean).join(' ')
}

export default function PlanningGlobalPage() {
  const [week, setWeek] = useState(() => weekRange(new Date()))
  const [customPeriod, setCustomPeriod] = useState(false)
  const [customFrom, setCustomFrom] = useState(week.from)
  const [customTo, setCustomTo] = useState(week.to)
  const [statusFilter, setStatusFilter] = useState<PlanningStatus | ''>('')
  const [userFilter, setUserFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [taskFilter, setTaskFilter] = useState('')
  const [notesFilter, setNotesFilter] = useState('')
  const [page, setPage] = useState(1)
  const from = customPeriod ? customFrom : week.from
  const to = customPeriod ? customTo : week.to
  const validPeriod = Boolean(from && to && from <= to)

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['planning-overview', from, to],
    queryFn: () => planningApi.overview(from, to),
    enabled: validPeriod,
    staleTime: 30_000,
  })

  const events = useMemo(() => overview?.events ?? [], [overview?.events])
  const users = useMemo(() => [...new Map(events.filter((e) => e.user).map((e) => [e.user!.id, e.user!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [events])
  const equipments = useMemo(() => [...new Map(events.filter((e) => e.equipment).map((e) => [e.equipment!.id, e.equipment!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [events])
  const types = useMemo(() => [...new Set(events.map((e) => e.type_evenement))].sort(), [events])
  const statusCounts = useMemo(() => events.reduce((counts, event) => {
    const status = eventStatus(event)
    counts[status] = (counts[status] ?? 0) + 1
    return counts
  }, {} as Partial<Record<PlanningStatus, number>>), [events])
  const filtered = useMemo(() => events.filter((event) =>
    (!statusFilter || eventStatus(event) === statusFilter)
    && (!userFilter || event.user_id === Number(userFilter))
    && (!equipmentFilter || event.equipment_id === Number(equipmentFilter))
    && (!eventFilter || event.type_evenement === eventFilter)
    && (!dateFilter || (dateInputFromApi(event.date_debut) <= dateFilter && dateInputFromApi(event.date_fin) >= dateFilter))
    && matchesText(taskDocumentText(event), taskFilter)
    && matchesText(event.notes, notesFilter)
  ), [events, statusFilter, userFilter, equipmentFilter, eventFilter, dateFilter, taskFilter, notesFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => setPage(1), [from, to, statusFilter, userFilter, equipmentFilter, eventFilter, dateFilter, taskFilter, notesFilter])

  function changeWeek(amount: number) {
    const monday = new Date(`${week.from}T12:00:00`)
    monday.setDate(monday.getDate() + 7 * amount)
    setWeek(weekRange(monday))
  }

  function selectWeek(date: string) {
    if (date) setWeek(weekRange(new Date(`${date}T12:00:00`)))
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Planification' }]}
      moduleBarLabel="Planification"
      title="Planning global"
      subtitle="Personnes, matériel et événements liés dans un seul tableau."
    >
      <div className="card planning-global__controls">
        <div className="planning-global__period">
          <button type="button" className={`btn btn-sm ${!customPeriod ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCustomPeriod(false)}>Semaine</button>
          <button type="button" className={`btn btn-sm ${customPeriod ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCustomPeriod(true)}>Période</button>
          {!customPeriod ? <>
            <button type="button" className="btn btn-secondary btn-sm" aria-label="Semaine précédente" onClick={() => changeWeek(-1)}>‹</button>
            <label>Semaine du <input type="date" aria-label="Choisir une semaine" value={week.from} onChange={(e) => selectWeek(e.target.value)} /></label>
            <span>au {new Date(`${week.to}T12:00:00`).toLocaleDateString('fr-FR')}</span>
            <button type="button" className="btn btn-secondary btn-sm" aria-label="Semaine suivante" onClick={() => changeWeek(1)}>›</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWeek(weekRange(new Date()))}>Cette semaine</button>
          </> : <>
            <label>Du <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></label>
            <label>Au <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></label>
          </>}
        </div>
        {!validPeriod ? <p className="error">Choisissez une période valide.</p> : null}
        <div className="planning-global__statuses" aria-label="Filtrer par statut">
          <button type="button" className={`planning-global__status ${statusFilter === '' ? 'is-active' : ''}`} onClick={() => setStatusFilter('')}>Tous <strong>{events.length}</strong></button>
          {(Object.keys(statusLabels) as PlanningStatus[]).map((status) =>
            <button type="button" key={status} className={`planning-global__status ${statusFilter === status ? 'is-active' : ''}`} onClick={() => setStatusFilter(status)}>{statusLabels[status]} <strong>{statusCounts[status] ?? 0}</strong></button>
          )}
        </div>
      </div>

      {isLoading ? <p className="text-muted">Chargement…</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}
      {validPeriod && !isLoading && !error ? <>
        <div className="planning-global__result-count">{filtered.length} événement{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''} du {new Date(`${from}T12:00:00`).toLocaleDateString('fr-FR')} au {new Date(`${to}T12:00:00`).toLocaleDateString('fr-FR')}</div>
        <div className="card table-wrap planning-global__table">
          <table className="data-table data-table--compact">
            <thead>
              <tr><th>Période</th><th>Utilisateur</th><th>Matériel</th><th>Événement</th><th>Statut</th><th>Tâche / document</th><th>Notes</th></tr>
              <tr className="planning-global__filter-row">
                <th><input type="date" aria-label="Filtrer par date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} /></th>
                <th><select aria-label="Filtrer par utilisateur" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><option value="">Tous</option>{users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></th>
                <th><select aria-label="Filtrer par matériel" value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}><option value="">Tout</option>{equipments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></th>
                <th><select aria-label="Filtrer par événement" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}><option value="">Tous</option>{types.map((type) => <option key={type} value={type}>{eventLabel(type)}</option>)}</select></th>
                <th><select aria-label="Filtrer par statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PlanningStatus | '')}><option value="">Tous</option>{(Object.keys(statusLabels) as PlanningStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></th>
                <th><input type="search" aria-label="Rechercher une tâche ou un document" placeholder="Rechercher…" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} /></th>
                <th><input type="search" aria-label="Rechercher dans les notes" placeholder="Rechercher…" value={notesFilter} onChange={(e) => setNotesFilter(e.target.value)} /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} className="text-muted">Aucun événement pour cette période et ces filtres.</td></tr> : null}
              {visible.map((event) => {
                const line = event.mission_task?.ordre_mission_ligne
                const om = line?.ordre_mission
                const bc = event.bon_commande_ligne?.bon_commande
                return <tr key={event.id}>
                  <td>{dateInputFromApi(event.date_debut)} → {dateInputFromApi(event.date_fin)}</td>
                  <td>{event.user?.name ?? '—'}</td>
                  <td>{event.equipment ? <Link to={`/materiel/equipements/${event.equipment.id}`}>{event.equipment.code ? `${event.equipment.code} — ` : ''}{event.equipment.name}</Link> : '—'}</td>
                  <td>{eventLabel(event.type_evenement)}</td>
                  <td>{statusLabels[eventStatus(event)]}</td>
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
        {pageCount > 1 ? <nav className="planning-global__pagination" aria-label="Pages du planning">
          <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Précédent</button>
          <span>Page {currentPage} sur {pageCount}</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Suivant</button>
        </nav> : null}
      </> : null}
    </ModuleEntityShell>
  )
}
