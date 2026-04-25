import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, equipmentsApi, type EquipmentRow } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

type PlanningEvent = {
  id: string
  date: string
  title: string
  subtitle: string
  kind: 'maintenance' | 'chantier'
  status?: string
  to?: string
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
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

export default function MaterielPlanningPage() {
  const qc = useQueryClient()
  const today = new Date()
  const [month, setMonth] = useState(today.toISOString().slice(0, 7))
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | ''>('')
  const [statusDraft, setStatusDraft] = useState('')
  const [locationDraft, setLocationDraft] = useState('')

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

  const selectedEquipment = equipments.find((eq) => eq.id === selectedEquipmentId)

  const updateEquipmentMut = useMutation({
    mutationFn: () => {
      if (!selectedEquipment) throw new Error('Sélectionnez un matériel.')
      return equipmentsApi.update(selectedEquipment.id, {
        status: statusDraft || selectedEquipment.status,
        location: locationDraft,
      })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['equipments'] }),
  })

  const events = useMemo<PlanningEvent[]>(() => {
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

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Matériel', to: '/materiel' },
        { label: 'Planning matériel' },
      ]}
      moduleBarLabel="Matériel"
      title="Planning matériel"
      subtitle="Calendrier croisant les échéances de maintenance/étalonnage et les dates prévues des chantiers."
    >
      <div className="card materiel-planning-toolbar">
        <label>
          Mois
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label>
          Matériel à gérer
          <select
            value={selectedEquipmentId === '' ? '' : String(selectedEquipmentId)}
            onChange={(e) => {
              const nextId = e.target.value ? Number(e.target.value) : ''
              const eq = equipments.find((item) => item.id === nextId)
              setSelectedEquipmentId(nextId)
              setStatusDraft(eq?.status ?? '')
              setLocationDraft(eq?.location ?? '')
            }}
          >
            <option value="">Choisir…</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.code} — {eq.name}
              </option>
            ))}
          </select>
        </label>
        {selectedEquipment && (
          <>
            <label>
              Statut
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                <option value="active">Actif</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retiré</option>
              </select>
            </label>
            <label>
              Localisation
              <input value={locationDraft} onChange={(e) => setLocationDraft(e.target.value)} placeholder="Dépôt, chantier…" />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => updateEquipmentMut.mutate()} disabled={updateEquipmentMut.isPending}>
              Enregistrer matériel
            </button>
          </>
        )}
      </div>

      {(loadingEquipments || loadingBc) && <p className="text-muted">Chargement du planning…</p>}
      {updateEquipmentMut.isError && <p className="error">{(updateEquipmentMut.error as Error).message}</p>}

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
      </div>
    </ModuleEntityShell>
  )
}
