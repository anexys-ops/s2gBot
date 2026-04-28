/**
 * OrdreMissionPlanningPage
 *
 * Vue calendrier mensuelle des ordres de mission.
 * Filtre par type (labo / technicien / ingénieur).
 * Affiche un slot par OM sur le jour planifié.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ordresMissionApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  labo:       { label: 'Labo',       color: '#10b981', bg: '#d1fae5' },
  technicien: { label: 'Terrain',    color: '#f59e0b', bg: '#fef3c7' },
  ingenieur:  { label: 'Ingénieur',  color: '#3b82f6', bg: '#dbeafe' },
}

function monthRange(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  return {
    from: first.toISOString().slice(0, 10),
    to:   last.toISOString().slice(0, 10),
    days: last.getDate(),
    firstDow: (first.getDay() + 6) % 7, // lundi = 0
  }
}

export default function OrdreMissionPlanningPage() {
  const now = new Date()
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth())
  const [typeFilter, setTypeFilter] = useState('')

  const { from, to, days, firstDow } = monthRange(year, month)

  const { data: ordres = [], isLoading } = useQuery({
    queryKey: ['om-planning', from, to, typeFilter],
    queryFn: () => ordresMissionApi.planning({ from, to, type: typeFilter || undefined }),
    staleTime: 30_000,
  })

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const byDay = new Map<number, typeof ordres>()
  for (const om of ordres) {
    if (!om.date_prevue) continue
    const d = new Date(om.date_prevue).getDate()
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(om)
  }

  const cells: Array<{ day: number | null }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ day: null })
  for (let d = 1; d <= days; d++) cells.push({ day: d })

  const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Ordres de mission', to: '/ordres-mission' }, { label: 'Planning' }]}
      moduleBarLabel="Commercial — Planning OMs"
      title="Planning ordres de mission"
      subtitle={monthLabel}
      actions={
        <Link to="/ordres-mission" className="btn btn-secondary btn-sm">← Liste</Link>
      }
    >
      {/* Nav mois + filtre type */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={prevMonth}>‹ Précédent</button>
        <strong style={{ minWidth: 180, textAlign: 'center' }}>{monthLabel}</strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={nextMonth}>Suivant ›</button>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ marginLeft: '1rem', flex: '0 0 auto' }}>
          <option value="">— Tous types —</option>
          {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        {isLoading && <span className="text-muted" style={{ fontSize: '0.85rem' }}>Chargement…</span>}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {Object.entries(TYPE_META).map(([k, m]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: m.bg, border: `2px solid ${m.color}`, display: 'inline-block' }} />
            {m.label}
          </span>
        ))}
      </div>

      {/* Calendrier */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* En-têtes jours */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
            <div key={d} style={{ padding: '0.4rem', textAlign: 'center', fontWeight: 600, fontSize: '0.82rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grille */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((cell, idx) => {
            const isToday = cell.day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
            const dayOMs = cell.day ? (byDay.get(cell.day) ?? []) : []
            return (
              <div
                key={idx}
                style={{
                  minHeight: 90,
                  padding: '0.4rem',
                  borderRight: '1px solid var(--color-border)',
                  borderBottom: '1px solid var(--color-border)',
                  background: !cell.day ? 'var(--color-surface)' : isToday ? 'rgba(59,130,246,0.05)' : undefined,
                }}
              >
                {cell.day && (
                  <>
                    <div style={{ fontWeight: isToday ? 700 : 400, fontSize: '0.82rem', color: isToday ? '#3b82f6' : 'var(--color-text)', marginBottom: '0.25rem' }}>
                      {cell.day}
                    </div>
                    {dayOMs.map((om) => {
                      const meta = TYPE_META[om.type] ?? { color: '#6b7280', bg: '#f3f4f6', label: om.type }
                      return (
                        <Link
                          key={om.id}
                          to={`/ordres-mission/${om.id}`}
                          style={{
                            display: 'block',
                            padding: '0.1rem 0.35rem',
                            borderRadius: 4,
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            color: meta.color,
                            background: meta.bg,
                            border: `1px solid ${meta.color}40`,
                            marginBottom: '0.2rem',
                            textDecoration: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`${om.numero} — ${om.client?.name ?? ''}`}
                        >
                          {om.numero}
                        </Link>
                      )
                    })}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Liste du mois */}
      {ordres.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Détail du mois ({ordres.length} OM)</h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Numéro</th>
                    <th>Type</th>
                    <th>Client</th>
                    <th>Responsable</th>
                    <th>Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  {ordres
                    .slice()
                    .sort((a, b) => (a.date_prevue ?? '').localeCompare(b.date_prevue ?? ''))
                    .map((om) => {
                      const meta = TYPE_META[om.type] ?? { color: '#6b7280', bg: '#f3f4f6', label: om.type }
                      return (
                        <tr key={om.id}>
                          <td>{om.date_prevue ? new Date(om.date_prevue).toLocaleDateString('fr-FR') : '—'}</td>
                          <td><Link to={`/ordres-mission/${om.id}`} className="link-inline" style={{ fontWeight: 600 }}>{om.numero}</Link></td>
                          <td><span style={{ color: meta.color, fontWeight: 600, fontSize: '0.82rem' }}>{meta.label}</span></td>
                          <td>{om.client?.name ?? `#${om.client_id}`}</td>
                          <td>{om.responsable?.name ?? '—'}</td>
                          <td>{om.lignes?.length ?? '—'}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ModuleEntityShell>
  )
}
