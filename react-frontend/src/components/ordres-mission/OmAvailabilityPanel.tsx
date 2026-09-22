import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  materielAffectationsApi,
  planningApi,
  type MaterielAffectationRow,
  type PlanningEquipmentSlot,
  type PlanningHuman,
  type StockEquipmentEntry,
  type StockPersonnel,
} from '../../api/client'

type Props = {
  userId: number
  userName: string
  equipment?: { id: number; name: string; code?: string } | null
  plannedDate?: string
}

type CalendarEvent = { key: string; label: string; tone: 'busy' | 'unavailable' | 'current' }

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateOnly(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function monthInput(dateValue?: string) {
  const parsed = dateValue ? new Date(`${dateOnly(dateValue)}T12:00:00`) : new Date()
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split('-').map(Number)
  return monthInput(toYmd(new Date(year, month - 1 + delta, 1)))
}

function rangeDates(start: string, end: string) {
  const result: string[] = []
  let cursor = new Date(`${dateOnly(start)}T12:00:00`)
  const last = new Date(`${dateOnly(end || start)}T12:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return result
  while (cursor <= last && result.length < 370) {
    result.push(toYmd(cursor))
    cursor = addDays(cursor, 1)
  }
  return result
}

function pushRange(
  target: Map<string, CalendarEvent[]>,
  start: string,
  end: string,
  event: Omit<CalendarEvent, 'key'> & { key: string },
) {
  for (const date of rangeDates(start, end)) {
    target.set(date, [...(target.get(date) ?? []), event])
  }
}

function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function OmAvailabilityPanel({ userId, userName, equipment, plannedDate }: Props) {
  const [month, setMonth] = useState(() => monthInput(plannedDate))
  const grid = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00`)
    const start = addDays(first, -((first.getDay() + 6) % 7))
    const days = Array.from({ length: 42 }, (_, index) => toYmd(addDays(start, index)))
    return { days, from: days[0], to: days[days.length - 1] }
  }, [month])

  const { data: humanSlots = [], isLoading: humanLoading } = useQuery({
    queryKey: ['om-availability', 'human', userId, grid.from, grid.to],
    queryFn: () => planningApi.humans.list({ user_id: userId, from: grid.from, to: grid.to }),
  })
  const { data: personnelBlocks = [], isLoading: personnelLoading } = useQuery({
    queryKey: ['om-availability', 'personnel-stock', userId, grid.from, grid.to],
    queryFn: () => planningApi.stockPersonnel.list({ user_id: userId, from: grid.from, to: grid.to }),
  })
  const { data: equipmentSlots = [], isLoading: equipmentLoading } = useQuery({
    queryKey: ['om-availability', 'equipment', equipment?.id, grid.from, grid.to],
    queryFn: () => planningApi.equipments.list({ equipment_id: equipment!.id, from: grid.from, to: grid.to }),
    enabled: Boolean(equipment?.id),
  })
  const { data: equipmentBlocks = [], isLoading: equipmentBlockLoading } = useQuery({
    queryKey: ['om-availability', 'equipment-stock', equipment?.id, grid.from, grid.to],
    queryFn: () => planningApi.stockEquipment.list({ equipment_id: equipment!.id, from: grid.from, to: grid.to }),
    enabled: Boolean(equipment?.id),
  })
  const { data: equipmentAffectations = [], isLoading: equipmentAffectLoading } = useQuery({
    queryKey: ['om-availability', 'equipment-affectations', equipment?.id, grid.from, grid.to],
    queryFn: () => materielAffectationsApi.list({ equipment_id: equipment!.id, from: grid.from, to: grid.to }),
    enabled: Boolean(equipment?.id),
  })

  const humanEvents = useMemo(() => {
    const byDate = new Map<string, CalendarEvent[]>()
    for (const slot of humanSlots as PlanningHuman[]) {
      pushRange(byDate, slot.date_debut, slot.date_fin, {
        key: `human-${slot.id}`,
        label: slot.notes || slot.type_evenement,
        tone: 'busy',
      })
    }
    for (const block of personnelBlocks as StockPersonnel[]) {
      pushRange(byDate, block.date_debut, block.date_fin, {
        key: `personnel-${block.id}`,
        label: block.motif,
        tone: 'unavailable',
      })
    }
    return byDate
  }, [humanSlots, personnelBlocks])

  const equipmentEvents = useMemo(() => {
    const byDate = new Map<string, CalendarEvent[]>()
    for (const slot of equipmentSlots as PlanningEquipmentSlot[]) {
      pushRange(byDate, slot.date_debut, slot.date_fin, {
        key: `equipment-slot-${slot.id}`,
        label: slot.notes || slot.type_evenement,
        tone: 'busy',
      })
    }
    for (const block of equipmentBlocks as StockEquipmentEntry[]) {
      pushRange(byDate, block.date_debut, block.date_fin, {
        key: `equipment-block-${block.id}`,
        label: block.motif,
        tone: 'unavailable',
      })
    }
    for (const affectation of equipmentAffectations as MaterielAffectationRow[]) {
      pushRange(byDate, affectation.date_debut, affectation.date_retour_effective || affectation.date_retour_prevue || affectation.date_debut, {
        key: `equipment-affect-${affectation.id}`,
        label: affectation.user?.name ? `Affecté à ${affectation.user.name}` : 'Affectation matériel',
        tone: 'busy',
      })
    }
    return byDate
  }, [equipmentAffectations, equipmentBlocks, equipmentSlots])

  const renderCalendar = (events: Map<string, CalendarEvent[]>, loading: boolean, ariaLabel: string) => (
    <div className="om-availability__calendar" aria-label={ariaLabel}>
      <div className="om-availability__weekdays" aria-hidden="true">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="om-availability__days">
        {grid.days.map((date) => {
          const dayEvents = events.get(date) ?? []
          const isPlanned = dateOnly(plannedDate) === date
          return (
            <div
              key={date}
              className={`om-availability__day${date.startsWith(month) ? '' : ' om-availability__day--outside'}${isPlanned ? ' om-availability__day--planned' : ''}`}
              title={dayEvents.map((event) => event.label).join(' · ')}
            >
              <span>{Number(date.slice(8, 10))}</span>
              <div className="om-availability__events">
                {isPlanned ? <i className="om-availability__event om-availability__event--current" title="Date prévue" /> : null}
                {dayEvents.slice(0, 3).map((event) => (
                  <i key={`${date}-${event.key}`} className={`om-availability__event om-availability__event--${event.tone}`} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {loading ? <p className="text-muted om-availability__loading">Chargement des disponibilités…</p> : null}
    </div>
  )

  return (
    <section className="card om-availability" aria-label="Disponibilités avant validation">
      <div className="om-availability__header">
        <div>
          <h2>Disponibilités avant validation</h2>
          <p className="text-muted">Vérifiez les occupations à la date prévue avant de valider la ligne.</p>
        </div>
        <div className="om-availability__month-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="Mois précédent">‹</button>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Mois des disponibilités" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="Mois suivant">›</button>
        </div>
      </div>
      <p className="om-availability__month-label">{monthLabel(month)}</p>
      <div className="om-availability__grids">
        <div>
          <h3>Technicien — {userName}</h3>
          {renderCalendar(humanEvents, humanLoading || personnelLoading, `Calendrier de ${userName}`)}
        </div>
        <div>
          <h3>Matériel — {equipment ? [equipment.code, equipment.name].filter(Boolean).join(' — ') : 'aucun matériel affecté'}</h3>
          {equipment
            ? renderCalendar(equipmentEvents, equipmentLoading || equipmentBlockLoading || equipmentAffectLoading, `Calendrier du matériel ${equipment.name}`)
            : <div className="om-availability__empty text-muted">Aucun matériel n’est actuellement affecté à cette tâche.</div>}
        </div>
      </div>
      <div className="om-availability__legend">
        <span><i className="om-availability__event om-availability__event--current" /> Date prévue</span>
        <span><i className="om-availability__event om-availability__event--busy" /> Occupé / affecté</span>
        <span><i className="om-availability__event om-availability__event--unavailable" /> Indisponible</span>
      </div>
    </section>
  )
}
