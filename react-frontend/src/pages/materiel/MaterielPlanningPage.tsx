import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, equipmentsApi, type EquipmentRow } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { MATERIEL_MODULE_TABS } from './materielModuleTabs'

type PlanningEvent = {
  id: string
  date: string
  title: string
  subtitle: string
  kind: 'maintenance' | 'chantier'
  status?: string
  equipmentId?: number
  to?: string
}

type EventKindFilter = '' | 'maintenance' | 'chantier'

const EVENT_KIND_OPTIONS: { value: EventKindFilter; label: string }[] = [
  { value: '', label: 'Tous les événements' },
  { value: 'maintenance', label: 'Maintenance / étalonnage' },
  { value: 'chantier', label: 'Chantiers' },
]

const EQUIPMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retiré' },
] as const

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function shiftMonth(month: string, delta: number) {
  const d = new Date(`${month}-01T00:00:00`)
  d.setMonth(d.getMonth() + delta)
  return d.toISOString().slice(0, 7)
}

function eventDay(date: string) {
  return String(date).slice(0, 10)
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function latestCalibration(eq: EquipmentRow) {
  const cals = eq.calibrations ?? []
  return cals.find((c) => c.next_due_date) ?? cals[0]
}

function statusLabel(value: string): string {
  return EQUIPMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export default function MaterielPlanningPage() {
  const qc = useQueryClient()
  const today = new Date()
  const [month, setMonth] = useState(today.toISOString().slice(0, 7))
  const [eventKind, setEventKind] = useState<EventKindFilter>('')
  const [calendarEquipmentId, setCalendarEquipmentId] = useState<number | ''>('')
  const [editEquipmentId, setEditEquipmentId] = useState<number | ''>('')
  const [statusDraft, setStatusDraft] = useState('')
  const [locationDraft, setLocationDraft] = useState('')
  const [saved, setSaved] = useState(false)

  const monthStart = `${month}-01`
  const monthEnd = toDateInput(addDays(new Date(`${month}-01T00:00:00`), 40))

  const { data: equipments = [], isLoading: loadingEquipments } = useQuery({
    queryKey: ['equipments', 'planning'],
    queryFn: () => equipmentsApi.list(),
  })
  const { data: bonsCommande = [], isLoading: loadingBc } = useQuery({
    queryKey: ['bons-commande', 'materiel-planning'],
    queryFn: () => bonsCommandeApi.list(),
  })

  const editEquipment = equipments.find((eq) => eq.id === editEquipmentId)

  const updateEquipmentMut = useMutation({
    mutationFn: () => {
      if (!editEquipment) throw new Error('Sélectionnez un matériel.')
      return equipmentsApi.update(editEquipment.id, {
        status: statusDraft || editEquipment.status,
        location: locationDraft,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['equipments'] })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 4000)
    },
  })

  const allEvents = useMemo<PlanningEvent[]>(() => {
    const maintenanceEvents = equipments.flatMap((eq) => {
      const cal = latestCalibration(eq)
      if (!cal?.next_due_date) return []
      return [{
        id: `maintenance-${eq.id}-${cal.id}`,
        date: eventDay(cal.next_due_date),
        title: eq.code,
        subtitle: `Maintenance / étalonnage : ${eq.name}`,
        kind: 'maintenance' as const,
        status: eq.status,
        equipmentId: eq.id,
        to: `/materiel/equipements/${eq.id}`,
      }]
    })

    const chantierEvents = bonsCommande.flatMap((bc) => {
      return (bc.lignes ?? []).flatMap((ligne) => {
        const start = ligne.date_debut_prevue ? eventDay(ligne.date_debut_prevue) : null
        const end = ligne.date_fin_prevue ? eventDay(ligne.date_fin_prevue) : null
        const dates = [start, end].filter((d): d is string => Boolean(d))
        return dates.map((date, index) => ({
          id: `chantier-${bc.id}-${ligne.id}-${index}`,
          date,
          title: bc.numero,
          subtitle: `${index === 0 ? 'Début' : 'Fin'} chantier prévu : ${ligne.libelle}`,
          kind: 'chantier' as const,
          status: bc.statut,
          to: `/bons-commande/${bc.id}`,
        }))
      })
    })

    return [...maintenanceEvents, ...chantierEvents]
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
  }, [bonsCommande, equipments, monthEnd, monthStart])

  const events = useMemo(() => {
    return allEvents.filter((event) => {
      if (eventKind && event.kind !== eventKind) return false
      if (calendarEquipmentId !== '') {
        if (event.kind !== 'maintenance') return false
        if (event.equipmentId !== calendarEquipmentId) return false
      }
      return true
    })
  }, [allEvents, calendarEquipmentId, eventKind])

  const days = useMemo(() => {
    const first = new Date(`${month}-01T00:00:00`)
    const start = addDays(first, -((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => {
      const date = toDateInput(addDays(start, i))
      return {
        date,
        inMonth: date.startsWith(month),
        events: events.filter((event) => event.date === date),
      }
    })
  }, [events, month])

  const hasCalendarFilters = eventKind !== '' || calendarEquipmentId !== ''
  const calendarEquipment = equipments.find((eq) => eq.id === calendarEquipmentId)

  function selectEditEquipment(nextId: number | '') {
    const eq = equipments.find((item) => item.id === nextId)
    setEditEquipmentId(nextId)
    setStatusDraft(eq?.status ?? '')
    setLocationDraft(eq?.location ?? '')
  }

  function resetCalendarFilters() {
    setEventKind('')
    setCalendarEquipmentId('')
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Matériel', to: '/materiel' },
        { label: 'Planning matériel' },
      ]}
      moduleBarLabel="Matériel"
      title="Planning matériel"
      subtitle={
        <>
          {events.length} événement{events.length !== 1 ? 's' : ''} affiché{events.length !== 1 ? 's' : ''} pour{' '}
          {monthLabel(month)}
          {hasCalendarFilters && allEvents.length !== events.length ? (
            <span className="text-muted"> (sur {allEvents.length} dans la période)</span>
          ) : null}
        </>
      }
      tabs={MATERIEL_MODULE_TABS}
    >
      <div className="card list-table-toolbar materiel-planning-toolbar">
        <section className="materiel-planning-toolbar__block">
          <div className="materiel-planning-toolbar__block-head">
            <h2 className="materiel-planning-toolbar__block-title">Affichage calendrier</h2>
            <p className="materiel-planning-toolbar__block-hint text-muted">
              Naviguez par mois et filtrez les échéances maintenance ou les dates chantier.
            </p>
          </div>
          <div className="list-table-toolbar__row materiel-planning-toolbar__row">
            <div className="list-table-toolbar__field materiel-planning-toolbar__month">
              <span className="filter-label">Mois</span>
              <div className="materiel-planning-toolbar__month-nav">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm materiel-planning-toolbar__month-btn"
                  onClick={() => setMonth((m) => shiftMonth(m, -1))}
                  aria-label="Mois précédent"
                >
                  ‹
                </button>
                <input
                  type="month"
                  className="materiel-planning-toolbar__month-input"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label="Mois affiché"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm materiel-planning-toolbar__month-btn"
                  onClick={() => setMonth((m) => shiftMonth(m, 1))}
                  aria-label="Mois suivant"
                >
                  ›
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setMonth(today.toISOString().slice(0, 7))}
                >
                  Aujourd&apos;hui
                </button>
              </div>
            </div>

            <label className="list-table-toolbar__field list-table-toolbar__status materiel-planning-toolbar__kind">
              <span className="filter-label">Type d&apos;événement</span>
              <select value={eventKind} onChange={(e) => setEventKind(e.target.value as EventKindFilter)}>
                {EVENT_KIND_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="list-table-toolbar__field materiel-planning-toolbar__equipment-filter">
              <span className="filter-label">Équipement (échéances)</span>
              <select
                value={calendarEquipmentId === '' ? '' : String(calendarEquipmentId)}
                onChange={(e) => setCalendarEquipmentId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Tous les équipements</option>
                {equipments.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} — {eq.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasCalendarFilters ? (
            <div className="list-table-toolbar__footer">
              <span className="list-table-toolbar__footer-label">Filtres actifs</span>
              {eventKind ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    {EVENT_KIND_OPTIONS.find((o) => o.value === eventKind)?.label}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setEventKind('')}
                    aria-label="Effacer le filtre type"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {calendarEquipmentId !== '' && calendarEquipment ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    Équipement : {calendarEquipment.code}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setCalendarEquipmentId('')}
                    aria-label="Effacer le filtre équipement"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetCalendarFilters}>
                Tout effacer
              </button>
            </div>
          ) : null}
        </section>

        <section className="materiel-planning-toolbar__block materiel-planning-toolbar__block--edit">
          <div className="materiel-planning-toolbar__block-head">
            <h2 className="materiel-planning-toolbar__block-title">Mise à jour rapide du matériel</h2>
            <p className="materiel-planning-toolbar__block-hint text-muted">
              Modifiez le statut ou l&apos;emplacement d&apos;un équipement sans quitter le planning.
            </p>
          </div>
          <div className="list-table-toolbar__row materiel-planning-toolbar__row">
            <label className="list-table-toolbar__field materiel-planning-toolbar__equipment-edit">
              <span className="filter-label">Matériel</span>
              <select
                value={editEquipmentId === '' ? '' : String(editEquipmentId)}
                onChange={(e) => selectEditEquipment(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Choisir un équipement…</option>
                {equipments.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} — {eq.name}
                  </option>
                ))}
              </select>
            </label>

            {editEquipment ? (
              <>
                <label className="list-table-toolbar__field list-table-toolbar__status">
                  <span className="filter-label">Statut</span>
                  <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                    {EQUIPMENT_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="list-table-toolbar__field materiel-planning-toolbar__location">
                  <span className="filter-label">Emplacement</span>
                  <input
                    className="materiel-planning-toolbar__text-input"
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    placeholder="Dépôt, chantier, labo…"
                  />
                </label>
                <div className="materiel-planning-toolbar__actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => updateEquipmentMut.mutate()}
                    disabled={updateEquipmentMut.isPending}
                  >
                    {updateEquipmentMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <Link to={`/materiel/equipements/${editEquipment.id}`} className="btn btn-secondary">
                    Ouvrir la fiche
                  </Link>
                </div>
              </>
            ) : (
              <p className="materiel-planning-toolbar__edit-placeholder text-muted">
                Sélectionnez un matériel pour mettre à jour son statut ou son emplacement.
              </p>
            )}
          </div>
          {editEquipment ? (
            <p className="materiel-planning-toolbar__edit-meta text-muted">
              {editEquipment.code} — statut actuel : {statusLabel(editEquipment.status)}
              {editEquipment.location?.trim() ? ` · ${editEquipment.location}` : ''}
            </p>
          ) : null}
        </section>
      </div>

      {(loadingEquipments || loadingBc) && <p className="text-muted">Chargement du planning…</p>}
      {updateEquipmentMut.isError ? <p className="error">{(updateEquipmentMut.error as Error).message}</p> : null}
      {saved ? <p className="text-muted materiel-planning-toolbar__saved">Matériel mis à jour.</p> : null}

      <div className="card materiel-calendar">
        <div className="materiel-calendar__head">
          <h2>{monthLabel(month)}</h2>
          <div className="materiel-calendar__legend">
            <span className="materiel-calendar__dot materiel-calendar__dot--maintenance" /> Maintenance / étalonnage
            <span className="materiel-calendar__dot materiel-calendar__dot--chantier" /> Chantier
          </div>
        </div>
        <div className="materiel-calendar__grid materiel-calendar__grid--weekdays">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => <strong key={day}>{day}</strong>)}
        </div>
        <div className="materiel-calendar__grid">
          {days.map((day) => (
            <div key={day.date} className={`materiel-calendar__day${day.inMonth ? '' : ' materiel-calendar__day--muted'}`}>
              <div className="materiel-calendar__date">{new Date(`${day.date}T00:00:00`).getDate()}</div>
              {day.events.map((event) => (
                event.to ? (
                  <Link key={event.id} to={event.to} className={`materiel-calendar__event materiel-calendar__event--${event.kind}`}>
                    <strong>{event.title}</strong>
                    <span>{event.subtitle}</span>
                  </Link>
                ) : (
                  <div key={event.id} className={`materiel-calendar__event materiel-calendar__event--${event.kind}`}>
                    <strong>{event.title}</strong>
                    <span>{event.subtitle}</span>
                  </div>
                )
              ))}
            </div>
          ))}
        </div>
        {!loadingEquipments && !loadingBc && events.length === 0 ? (
          <p className="dossier-tab-empty materiel-calendar__empty">
            Aucun événement ne correspond aux filtres pour ce mois.
          </p>
        ) : null}
      </div>
    </ModuleEntityShell>
  )
}
