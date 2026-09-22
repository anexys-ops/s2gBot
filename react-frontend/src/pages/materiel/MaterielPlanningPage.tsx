import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminUsersApi,
  dossiersApi,
  equipmentsApi,
  materielAffectationsApi,
  type MaterielAffectationRow,
} from '../../api/client'
import Modal from '../../components/Modal'
import { dateInputValue, daysInRange, toLocalDateInput } from '../../components/materiel/equipmentSuiviUtils'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import { formatAppDate } from '../../lib/appLocale'
import { MATERIEL_HOME, MATERIEL_MODULE_TABS } from './materielModuleTabs'

type CalendarView = 'month' | 'week' | 'day'

type PlanningEvent = {
  id: string
  date: string
  title: string
  subtitle: string
  equipmentId: number
  to: string
}

type NewEventForm = {
  equipmentId: string
  dossierId: string
  userId: string
  dateDebut: string
  dateRetourPrevue: string
  observations: string
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  return d
}

function localDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function startOfWeek(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7))
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function rangeLabel(view: CalendarView, from: string, to: string) {
  if (view === 'month') return monthLabel(localDate(from))
  if (view === 'day') {
    return localDate(from).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  return `Du ${formatAppDate(from)} au ${formatAppDate(to)}`
}

function statusLabel(affectation: MaterielAffectationRow) {
  return affectation.date_retour_effective ? 'Restitué' : 'Sur chantier'
}

function emptyNewEvent(date: string): NewEventForm {
  return {
    equipmentId: '',
    dossierId: '',
    userId: '',
    dateDebut: date,
    dateRetourPrevue: '',
    observations: '',
  }
}

export default function MaterielPlanningPage() {
  const today = toLocalDateInput(new Date())
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [view, setView] = useState<CalendarView>('month')
  const [cursorDate, setCursorDate] = useState(today)
  const [calendarEquipmentId, setCalendarEquipmentId] = useState<number | ''>('')
  const [newEventOpen, setNewEventOpen] = useState(false)
  const [newEvent, setNewEvent] = useState<NewEventForm>(() => emptyNewEvent(today))

  const calendarRange = useMemo(() => {
    const cursor = localDate(cursorDate)
    if (view === 'day') return { from: cursorDate, to: cursorDate }
    if (view === 'week') {
      const from = startOfWeek(cursor)
      return { from: toLocalDateInput(from), to: toLocalDateInput(addDays(from, 6)) }
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)
    const gridStart = startOfWeek(first)
    return { from: toLocalDateInput(gridStart), to: toLocalDateInput(addDays(gridStart, 41)) }
  }, [cursorDate, view])

  const { data: equipments = [], isLoading: loadingEquipments } = useQuery({
    queryKey: ['equipments', 'planning'],
    queryFn: () => equipmentsApi.list(),
  })
  const { data: affectations = [], isLoading: loadingAffect } = useQuery({
    queryKey: ['materiel-affectations', calendarRange.from, calendarRange.to, calendarEquipmentId],
    queryFn: () => materielAffectationsApi.list({
      from: calendarRange.from,
      to: calendarRange.to,
      equipment_id: calendarEquipmentId === '' ? undefined : calendarEquipmentId,
    }),
  })
  const { data: affectationHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['materiel-affectations', 'history'],
    queryFn: () => materielAffectationsApi.list(),
  })
  const { data: dossiers = [] } = useQuery({
    queryKey: ['dossiers', 'materiel-planning'],
    queryFn: () => dossiersApi.list(),
    enabled: isAdmin && newEventOpen,
  })
  const { data: usersPage } = useQuery({
    queryKey: ['admin-users', 'materiel-planning'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    enabled: isAdmin && newEventOpen,
  })

  const allEvents = useMemo<PlanningEvent[]>(() => {
    return affectations
      .filter((affectation) => affectation.dossier_id && !affectation.date_retour_effective)
      .flatMap((affectation) => {
        const end = affectation.date_retour_prevue || calendarRange.to
        return daysInRange(affectation.date_debut, end).map((date) => ({
          id: `affect-${affectation.id}-${date}`,
          date: dateInputValue(date),
          title: affectation.equipment?.code ?? `#${affectation.equipment_id}`,
          subtitle: [
            affectation.dossier?.reference ? `Chantier ${affectation.dossier.reference}` : 'Chantier',
            affectation.user?.name,
          ].filter(Boolean).join(' — '),
          equipmentId: affectation.equipment_id,
          to: `/materiel/equipements/${affectation.equipment_id}`,
        }))
      })
      .filter((event) => event.date >= calendarRange.from && event.date <= calendarRange.to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
  }, [affectations, calendarRange.from, calendarRange.to])

  const events = useMemo(
    () => allEvents.filter((event) => calendarEquipmentId === '' || event.equipmentId === calendarEquipmentId),
    [allEvents, calendarEquipmentId],
  )

  const days = useMemo(() => daysInRange(calendarRange.from, calendarRange.to).map((date) => ({
    date,
    inMonth: localDate(date).getMonth() === localDate(cursorDate).getMonth(),
    events: events.filter((event) => event.date === date),
  })), [calendarRange.from, calendarRange.to, cursorDate, events])

  const activeEquipmentIds = useMemo(() => new Set(allEvents.map((event) => event.equipmentId)), [allEvents])
  const chantierEquipments = equipments.filter((equipment) => activeEquipmentIds.has(equipment.id))
  const calendarEquipment = equipments.find((equipment) => equipment.id === calendarEquipmentId)
  const historyRows = useMemo(
    () => [...affectationHistory]
      .filter((affectation) => affectation.dossier_id)
      .sort((a, b) => String(b.date_debut).localeCompare(String(a.date_debut))),
    [affectationHistory],
  )

  const createMutation = useMutation({
    mutationFn: () => equipmentsApi.createAffectation(Number(newEvent.equipmentId), {
      dossier_id: Number(newEvent.dossierId),
      user_id: newEvent.userId ? Number(newEvent.userId) : null,
      date_debut: newEvent.dateDebut,
      date_retour_prevue: newEvent.dateRetourPrevue || null,
      observations: newEvent.observations.trim() || null,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['materiel-affectations'] })
      setNewEventOpen(false)
      setNewEvent(emptyNewEvent(cursorDate))
    },
  })

  const returnMutation = useMutation({
    mutationFn: (affectation: MaterielAffectationRow) => equipmentsApi.updateAffectation(
      affectation.equipment_id,
      affectation.id,
      { date_retour_effective: today, etat_retour: 'bon' },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['materiel-affectations'] })
      void queryClient.invalidateQueries({ queryKey: ['equipments'] })
    },
  })

  function shiftCursor(delta: number) {
    const cursor = localDate(cursorDate)
    const next = view === 'month' ? addMonths(cursor, delta) : addDays(cursor, delta * (view === 'week' ? 7 : 1))
    setCursorDate(toLocalDateInput(next))
  }

  const dayGridStyle = view === 'day' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined
  const weekdayLabels = view === 'day'
    ? [localDate(cursorDate).toLocaleDateString('fr-FR', { weekday: 'long' })]
    : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Parc équipements', to: MATERIEL_HOME },
        { label: 'Planning matériel' },
      ]}
      moduleBarLabel="Matériel"
      title="Planning matériel"
      subtitle={`${events.length} événement${events.length !== 1 ? 's' : ''} affiché${events.length !== 1 ? 's' : ''}`}
      tabs={MATERIEL_MODULE_TABS}
      actions={isAdmin ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setNewEvent(emptyNewEvent(cursorDate))
            setNewEventOpen(true)
          }}
        >
          Ajouter un événement
        </button>
      ) : undefined}
    >
      <div className="card list-table-toolbar materiel-planning-toolbar">
        <section className="materiel-planning-toolbar__block">
          <div className="materiel-planning-toolbar__block-head">
            <h2 className="materiel-planning-toolbar__block-title">Affichage calendrier</h2>
            <p className="materiel-planning-toolbar__block-hint text-muted">
              Seuls les matériels réellement affectés à un chantier sont affichés.
            </p>
          </div>
          <div className="list-table-toolbar__row materiel-planning-toolbar__row">
            <div className="list-table-toolbar__field">
              <span className="filter-label">Vue</span>
              <div className="materiel-planning-view-switch" role="group" aria-label="Période du calendrier">
                {([
                  ['month', 'Mois'],
                  ['week', 'Semaine'],
                  ['day', 'Jour'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn btn-sm ${view === value ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setView(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="list-table-toolbar__field materiel-planning-toolbar__month">
              <span className="filter-label">Date affichée</span>
              <div className="materiel-planning-toolbar__month-nav">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftCursor(-1)} aria-label="Période précédente">‹</button>
                <input
                  type={view === 'month' ? 'month' : 'date'}
                  className="materiel-planning-toolbar__month-input"
                  value={view === 'month' ? cursorDate.slice(0, 7) : cursorDate}
                  onChange={(event) => setCursorDate(view === 'month' ? `${event.target.value}-01` : event.target.value)}
                  aria-label="Date affichée"
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftCursor(1)} aria-label="Période suivante">›</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCursorDate(today)}>Aujourd&apos;hui</button>
              </div>
            </div>
            <label className="list-table-toolbar__field materiel-planning-toolbar__equipment-filter">
              <span className="filter-label">Équipement</span>
              <select value={calendarEquipmentId} onChange={(event) => setCalendarEquipmentId(event.target.value ? Number(event.target.value) : '')}>
                <option value="">Tous les équipements</option>
                {chantierEquipments.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.code} — {equipment.name}</option>)}
              </select>
            </label>
          </div>
          {calendarEquipment ? (
            <div className="list-table-toolbar__footer">
              <span className="list-table-toolbar__chip">
                <span className="list-table-toolbar__chip-text">Équipement : {calendarEquipment.code}</span>
                <button type="button" className="list-table-toolbar__chip-remove" onClick={() => setCalendarEquipmentId('')} aria-label="Effacer le filtre équipement">×</button>
              </span>
            </div>
          ) : null}
        </section>
      </div>

      {(loadingEquipments || loadingAffect) && <p className="text-muted">Chargement du planning…</p>}

      <div className="card materiel-calendar">
        <div className="materiel-calendar__head">
          <h2>{view === 'month' ? monthLabel(localDate(cursorDate)) : rangeLabel(view, calendarRange.from, calendarRange.to)}</h2>
          <div className="materiel-calendar__legend"><span className="materiel-calendar__dot materiel-calendar__dot--chantier" /> Matériel sur chantier</div>
        </div>
        <div className="materiel-calendar__grid materiel-calendar__grid--weekdays" style={dayGridStyle}>
          {weekdayLabels.map((day) => <strong key={day}>{day}</strong>)}
        </div>
        <div className="materiel-calendar__grid" style={dayGridStyle}>
          {days.map((day) => (
            <div key={day.date} className={`materiel-calendar__day${view === 'month' && !day.inMonth ? ' materiel-calendar__day--muted' : ''}`}>
              <div className="materiel-calendar__date">{view === 'day' ? formatAppDate(day.date) : localDate(day.date).getDate()}</div>
              {day.events.map((event) => (
                <Link key={event.id} to={event.to} className="materiel-calendar__event materiel-calendar__event--chantier">
                  <strong>{event.title}</strong><span>{event.subtitle}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        {!loadingEquipments && !loadingAffect && events.length === 0 ? (
          <p className="dossier-tab-empty materiel-calendar__empty">Aucun matériel n&apos;est affecté à un chantier pour cette période.</p>
        ) : null}
      </div>

      <section className="card dossier-tab-panel dossier-tab-panel--table materiel-usage-list">
        <div className="materiel-calendar__head">
          <div>
            <h2>Matériel utilisé et restitué</h2>
            <p className="text-muted">Le retour peut être validé après la clôture de la tâche.</p>
          </div>
        </div>
        {loadingHistory ? <p className="text-muted">Chargement…</p> : historyRows.length === 0 ? (
          <p className="dossier-tab-empty">Aucune utilisation de matériel enregistrée.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead><tr><th>Matériel</th><th>Chantier</th><th>Technicien</th><th>Début</th><th>Retour</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td><Link className="link-inline" to={`/materiel/equipements/${row.equipment_id}`}>{row.equipment?.code ?? `#${row.equipment_id}`}</Link></td>
                    <td>{row.dossier?.reference ?? '—'}</td>
                    <td>{row.user?.name ?? '—'}</td>
                    <td>{formatAppDate(row.date_debut)}</td>
                    <td>{row.date_retour_effective ? formatAppDate(row.date_retour_effective) : row.date_retour_prevue ? formatAppDate(row.date_retour_prevue) : '—'}</td>
                    <td><span className={`badge ${row.date_retour_effective ? 'badge-success' : 'badge-warning'}`}>{statusLabel(row)}</span></td>
                    <td>{!row.date_retour_effective && (isAdmin || row.user_id === user?.id) ? (
                      <button type="button" className="btn btn-primary btn-sm" disabled={returnMutation.isPending} onClick={() => returnMutation.mutate(row)}>Matériel restitué</button>
                    ) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {returnMutation.isError ? <p className="error">{(returnMutation.error as Error).message}</p> : null}
      </section>

      {newEventOpen ? (
        <Modal title="Ajouter un événement matériel" onClose={createMutation.isPending ? () => {} : () => setNewEventOpen(false)}>
          <form className="catalogue-article-new-form" onSubmit={(event) => { event.preventDefault(); createMutation.mutate() }}>
            <p className="text-muted">Affectez manuellement un matériel à un chantier pour réserver les dates dans le planning.</p>
            <div className="catalogue-article-new-form__grid">
              <label className="catalogue-article-new-form__col-6">Matériel *
                <select required value={newEvent.equipmentId} onChange={(event) => setNewEvent({ ...newEvent, equipmentId: event.target.value })}>
                  <option value="">— Choisir —</option>
                  {equipments.filter((equipment) => equipment.status === 'active').map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.code} — {equipment.name}</option>)}
                </select>
              </label>
              <label className="catalogue-article-new-form__col-6">Chantier *
                <select required value={newEvent.dossierId} onChange={(event) => setNewEvent({ ...newEvent, dossierId: event.target.value })}>
                  <option value="">— Choisir —</option>
                  {dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.reference}</option>)}
                </select>
              </label>
              <label className="catalogue-article-new-form__col-6">Technicien
                <select value={newEvent.userId} onChange={(event) => setNewEvent({ ...newEvent, userId: event.target.value })}>
                  <option value="">— Non assigné —</option>
                  {(usersPage?.data ?? []).map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
                </select>
              </label>
              <label className="catalogue-article-new-form__col-3">Date de début *
                <input required type="date" value={newEvent.dateDebut} onChange={(event) => setNewEvent({ ...newEvent, dateDebut: event.target.value })} />
              </label>
              <label className="catalogue-article-new-form__col-3">Retour prévu
                <input type="date" min={newEvent.dateDebut} value={newEvent.dateRetourPrevue} onChange={(event) => setNewEvent({ ...newEvent, dateRetourPrevue: event.target.value })} />
              </label>
              <label className="catalogue-article-new-form__col-12">Observations
                <textarea value={newEvent.observations} onChange={(event) => setNewEvent({ ...newEvent, observations: event.target.value })} rows={3} />
              </label>
            </div>
            {createMutation.isError ? <p className="error">{(createMutation.error as Error).message}</p> : null}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={!newEvent.equipmentId || !newEvent.dossierId || !newEvent.dateDebut || createMutation.isPending}>{createMutation.isPending ? 'Ajout…' : 'Ajouter au planning'}</button>
              <button type="button" className="btn btn-secondary" disabled={createMutation.isPending} onClick={() => setNewEventOpen(false)}>Annuler</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </ModuleEntityShell>
  )
}
