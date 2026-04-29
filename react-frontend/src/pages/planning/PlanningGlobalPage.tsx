/**
 * PlanningGlobalPage
 *
 * Vue planning mensuelle unifiée :
 *  - Colonne par personne / machine
 *  - Ligne par jour
 *  - Code couleur par type d'événement
 *  - Onglets : Personnel | Matériel | Indisponibilités
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { planningApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

type TabId = 'personnel' | 'materiel' | 'indispo'

const EVENT_COLORS: Record<string, string> = {
  tache:        '#3b82f6',
  utilisation:  '#3b82f6',
  conge:        '#10b981',
  formation:    '#8b5cf6',
  absent:       '#f59e0b',
  maintenance:  '#f59e0b',
  panne:        '#ef4444',
  calibration:  '#6b7280',
  indispo:      '#ef4444',
  autre:        '#6b7280',
}

function monthRange(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  return {
    from:     first.toISOString().slice(0, 10),
    to:       last.toISOString().slice(0, 10),
    days:     last.getDate(),
    label:    first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  }
}

function dayLabel(year: number, month: number, day: number) {
  return new Date(year, month, day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

export default function PlanningGlobalPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [tab, setTab]     = useState<TabId>('personnel')

  const { from, to, days, label } = monthRange(year, month)

  const { data: overview, isLoading } = useQuery({
    queryKey: ['planning-overview', from, to],
    queryFn: () => planningApi.overview(from, to),
    staleTime: 30_000,
  })

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  // Grouper les slots par personne/équipement pour la grille
  const humanSlots   = overview?.humans ?? []
  const equipSlots   = overview?.equipments ?? []
  const stockPerso   = overview?.stock_personnels ?? []
  const stockEquip   = overview?.stock_equipments ?? []

  const humanNames   = [...new Map(humanSlots.map((s) => [s.user_id, s.user?.name ?? `#${s.user_id}`])).entries()]
  const equipNames   = [...new Map(equipSlots.map((s) => [s.equipment_id, s.equipment?.name ?? `#${s.equipment_id}`])).entries()]

  function slotsForDay(day: number, userId?: number, equipId?: number): Array<{ label: string; color: string }> {
    const d = new Date(year, month, day).toISOString().slice(0, 10)
    if (userId !== undefined) {
      return [
        ...humanSlots
          .filter((s) => s.user_id === userId && s.date_debut <= d && s.date_fin >= d)
          .map((s) => ({
            label: s.missionTask ? `Tâche #${s.mission_task_id}` : s.type_evenement,
            color: EVENT_COLORS[s.type_evenement] ?? '#6b7280',
          })),
        ...stockPerso
          .filter((s) => s.user_id === userId && s.date_debut <= d && s.date_fin >= d)
          .map((s) => ({ label: s.motif, color: EVENT_COLORS[s.motif] ?? '#6b7280' })),
      ]
    }
    if (equipId !== undefined) {
      return [
        ...equipSlots
          .filter((s) => s.equipment_id === equipId && s.date_debut <= d && s.date_fin >= d)
          .map((s) => ({
            label: s.missionTask ? `Tâche #${s.mission_task_id}` : s.type_evenement,
            color: EVENT_COLORS[s.type_evenement] ?? '#6b7280',
          })),
        ...stockEquip
          .filter((s) => s.equipment_id === equipId && s.date_debut <= d && s.date_fin >= d)
          .map((s) => ({ label: s.motif, color: EVENT_COLORS[s.motif] ?? '#6b7280' })),
      ]
    }
    return []
  }

  const subjects = tab === 'materiel' ? equipNames : humanNames
  const gridCols = `80px repeat(${subjects.length}, minmax(80px, 1fr))`

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Planning' }]}
      moduleBarLabel="Planning global"
      title="Planning global"
      subtitle={label}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={prevMonth}>‹</button>
          <strong style={{ minWidth: 140, textAlign: 'center', lineHeight: '1.8' }}>{label}</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={nextMonth}>›</button>
        </div>
      }
    >
      {/* Onglets */}
      <div className="article-fiche-tabs" role="tablist" style={{ marginBottom: '1rem' }}>
        {(['personnel', 'materiel', 'indispo'] as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            className={`article-fiche-tabs__btn${tab === t ? ' article-fiche-tabs__btn--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'personnel' ? '👤 Personnel' : t === 'materiel' ? '🔧 Matériel' : '🚫 Indisponibilités'}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted">Chargement…</p>}

      {/* Vue indisponibilités */}
      {tab === 'indispo' && !isLoading && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Congés / Absences personnel</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table data-table--compact">
                <thead>
                  <tr><th>Personne</th><th>Du</th><th>Au</th><th>Motif</th></tr>
                </thead>
                <tbody>
                  {stockPerso.length === 0 ? (
                    <tr><td colSpan={4} className="text-muted" style={{ padding: '0.75rem' }}>Aucune indisponibilité</td></tr>
                  ) : stockPerso.map((s) => (
                    <tr key={s.id}>
                      <td>{s.user?.name ?? `#${s.user_id}`}</td>
                      <td>{new Date(s.date_debut).toLocaleDateString('fr-FR')}</td>
                      <td>{new Date(s.date_fin).toLocaleDateString('fr-FR')}</td>
                      <td><span className="badge">{s.motif}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Maintenance / Indispo matériel</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table data-table--compact">
                <thead>
                  <tr><th>Équipement</th><th>Du</th><th>Au</th><th>Motif</th></tr>
                </thead>
                <tbody>
                  {stockEquip.length === 0 ? (
                    <tr><td colSpan={4} className="text-muted" style={{ padding: '0.75rem' }}>Aucune indisponibilité</td></tr>
                  ) : stockEquip.map((s) => (
                    <tr key={s.id}>
                      <td>{s.equipment?.name ?? `#${s.equipment_id}`}</td>
                      <td>{new Date(s.date_debut).toLocaleDateString('fr-FR')}</td>
                      <td>{new Date(s.date_fin).toLocaleDateString('fr-FR')}</td>
                      <td><span className="badge">{s.motif}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vue grille calendaire */}
      {tab !== 'indispo' && !isLoading && (
        <>
          {subjects.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <p className="text-muted">Aucune donnée de planning pour cette période.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, minWidth: 400 }}>
                {/* En-tête */}
                <div style={{ padding: '0.4rem', fontWeight: 600, fontSize: '0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                  Jour
                </div>
                {subjects.map(([id, name]) => (
                  <div key={id} style={{
                    padding: '0.4rem', fontWeight: 600, fontSize: '0.75rem', textAlign: 'center',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
                    borderRight: '1px solid var(--color-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </div>
                ))}

                {/* Lignes jours */}
                {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
                  const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
                  const isWeekend = [0, 6].includes(new Date(year, month, day).getDay())
                  return (
                    <>
                      <div key={`d-${day}`} style={{
                        padding: '0.3rem 0.4rem', fontSize: '0.75rem',
                        fontWeight: isToday ? 700 : 400,
                        color: isToday ? '#3b82f6' : isWeekend ? 'var(--color-text-muted)' : 'var(--color-text)',
                        background: isWeekend ? 'var(--color-surface)' : undefined,
                        borderBottom: '1px solid var(--color-border)',
                        borderRight: '1px solid var(--color-border)',
                      }}>
                        {dayLabel(year, month, day)}
                      </div>
                      {subjects.map(([id]) => {
                        const slots = slotsForDay(day,
                          tab === 'personnel' ? Number(id) : undefined,
                          tab === 'materiel'  ? Number(id) : undefined,
                        )
                        return (
                          <div key={`${id}-${day}`} style={{
                            padding: '0.2rem 0.3rem', minHeight: 28,
                            background: isWeekend ? 'var(--color-surface)' : undefined,
                            borderBottom: '1px solid var(--color-border)',
                            borderRight: '1px solid var(--color-border)',
                          }}>
                            {slots.map((s, i) => (
                              <div key={i} style={{
                                fontSize: '0.65rem', padding: '1px 4px', borderRadius: 3,
                                background: s.color + '22', color: s.color,
                                fontWeight: 600, marginBottom: 1,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {s.label}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Légende */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {Object.entries(EVENT_COLORS).slice(0, 6).map(([k, c]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
            {k}
          </span>
        ))}
      </div>
    </ModuleEntityShell>
  )
}
