import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { equipmentsApi, materielAffectationsApi } from '../../api/client'
import {
  dateInputValue,
  daysInRange,
  toLocalDateInput,
} from '../../components/materiel/equipmentSuiviUtils'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { MATERIEL_HOME, MATERIEL_MODULE_TABS } from './materielModuleTabs'

type PlanningEvent = {
  id: string
  date: string
  title: string
  subtitle: string
  kind: 'chantier'
  equipmentId?: number
  to?: string
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toMonthInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toMonthInput(d)
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function eventDay(date: string) {
  return dateInputValue(date)
}

export default function MaterielPlanningPage() {
  const [month, setMonth] = useState(() => toMonthInput(new Date()))
  const [calendarEquipmentId, setCalendarEquipmentId] = useState<number | ''>('')

  const calendarRange = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00`)
    const gridStart = addDays(first, -((first.getDay() + 6) % 7))
    const gridEnd = addDays(gridStart, 41)
    return { from: toLocalDateInput(gridStart), to: toLocalDateInput(gridEnd) }
  }, [month])

  const { data: equipments = [], isLoading: loadingEquipments } = useQuery({
    queryKey: ['equipments', 'planning'],
    queryFn: () => equipmentsApi.list(),
  })
  const { data: affectations = [], isLoading: loadingAffect } = useQuery({
    queryKey: ['materiel-affectations', calendarRange.from, calendarRange.to, calendarEquipmentId],
    queryFn: () =>
      materielAffectationsApi.list({
        from: calendarRange.from,
        to: calendarRange.to,
        equipment_id: calendarEquipmentId === '' ? undefined : calendarEquipmentId,
      }),
  })

  const allEvents = useMemo<PlanningEvent[]>(() => {
    return affectations
      .filter((affectation) => affectation.dossier_id && !affectation.date_retour_effective)
      .flatMap((a) => {
        const end = a.date_retour_prevue || calendarRange.to
        const days = daysInRange(a.date_debut, end)
        return days.map((date) => ({
          id: `affect-${a.id}-${date}`,
          date: eventDay(date),
          title: a.equipment?.code ?? `#${a.equipment_id}`,
          subtitle: [
            a.dossier?.reference ? `Chantier ${a.dossier.reference}` : 'Chantier',
            a.user?.name,
          ].filter(Boolean).join(' — '),
          kind: 'chantier' as const,
          equipmentId: a.equipment_id,
          to: `/materiel/equipements/${a.equipment_id}`,
        }))
      })
      .filter((e) => e.date >= calendarRange.from && e.date <= calendarRange.to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
  }, [affectations, calendarRange.from, calendarRange.to])

  const events = useMemo(() => {
    return allEvents.filter((event) => {
      if (calendarEquipmentId !== '' && event.equipmentId !== calendarEquipmentId) return false
      return true
    })
  }, [allEvents, calendarEquipmentId])

  const days = useMemo(() => {
    const first = new Date(`${month}-01T00:00:00`)
    const start = addDays(first, -((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => {
      const date = toLocalDateInput(addDays(start, i))
      return {
        date,
        inMonth: date.startsWith(month),
        events: events.filter((event) => event.date === date),
      }
    })
  }, [events, month])

  const activeEquipmentIds = useMemo(() => new Set(allEvents.map((event) => event.equipmentId)), [allEvents])
  const chantierEquipments = equipments.filter((equipment) => activeEquipmentIds.has(equipment.id))
  const hasCalendarFilters = calendarEquipmentId !== ''
  const calendarEquipment = equipments.find((eq) => eq.id === calendarEquipmentId)

  function resetCalendarFilters() {
    setCalendarEquipmentId('')
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Parc équipements', to: MATERIEL_HOME },
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
              Seuls les matériels réellement affectés à un chantier sont affichés.
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
                  onClick={() => setMonth(toMonthInput(new Date()))}
                >
                  Aujourd&apos;hui
                </button>
              </div>
            </div>

            <label className="list-table-toolbar__field materiel-planning-toolbar__equipment-filter">
              <span className="filter-label">Équipement</span>
              <select
                value={calendarEquipmentId === '' ? '' : String(calendarEquipmentId)}
                onChange={(e) => setCalendarEquipmentId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Tous les équipements</option>
                {chantierEquipments.map((eq) => (
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
              {calendarEquipment ? (
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
      </div>

      {(loadingEquipments || loadingAffect) && (
        <p className="text-muted">Chargement du planning…</p>
      )}

      <div className="card materiel-calendar">
        <div className="materiel-calendar__head">
          <h2>{monthLabel(month)}</h2>
          <div className="materiel-calendar__legend">
            <span className="materiel-calendar__dot materiel-calendar__dot--chantier" /> Matériel sur chantier
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
        {!loadingEquipments && !loadingAffect && events.length === 0 ? (
          <p className="dossier-tab-empty materiel-calendar__empty">
            Aucun matériel n&apos;est affecté à un chantier pour ce mois.
          </p>
        ) : null}
      </div>
    </ModuleEntityShell>
  )
}
