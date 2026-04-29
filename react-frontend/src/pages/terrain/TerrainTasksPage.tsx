/**
 * TerrainTasksPage
 *
 * Tableau de bord des tâches terrain (techniciens / ingénieurs).
 * Formulaires de mesures terrain, affectation, statuts.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { missionTasksApi, type ActionMeasureConfig, type MissionTask } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  technicien: { label: 'Technicien', color: '#f59e0b', bg: '#fef3c7' },
  ingenieur:  { label: 'Ingénieur',  color: '#3b82f6', bg: '#dbeafe' },
}

const STATUT_META: Record<string, { label: string; color: string }> = {
  todo:        { label: 'À faire',  color: '#6b7280' },
  in_progress: { label: 'En cours', color: '#f59e0b' },
  done:        { label: 'Terminé',  color: '#3b82f6' },
  validated:   { label: 'Validé',   color: '#10b981' },
  rejected:    { label: 'Rejeté',   color: '#ef4444' },
}

function MeasureInput({
  config,
  value,
  onChange,
}: {
  config: ActionMeasureConfig
  value: string
  onChange: (v: string) => void
}) {
  const isOutOfRange = config.field_type === 'number' && value !== '' &&
    ((config.min_value != null && Number(value) < config.min_value) ||
     (config.max_value != null && Number(value) > config.max_value))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
      <span style={{ fontWeight: 500 }}>
        {config.field_name}
        {config.is_required && <span style={{ color: '#ef4444' }}> *</span>}
        {config.unit && <span className="text-muted" style={{ marginLeft: 4, fontSize: '0.75rem' }}>{config.unit}</span>}
      </span>
      {config.field_type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontSize: '0.82rem' }}>
          <option value="">—</option>
          {(config.select_options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : config.field_type === 'boolean' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontSize: '0.82rem' }}>
          <option value="">—</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : (
        <input
          type={config.field_type === 'date' ? 'date' : 'number'}
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: '0.82rem', borderColor: isOutOfRange ? '#ef4444' : undefined }}
          placeholder={config.placeholder ?? ''}
        />
      )}
      {isOutOfRange && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Hors bornes [{config.min_value} – {config.max_value}]</span>}
    </div>
  )
}

function TerrainTaskCard({ task }: { task: MissionTask }) {
  const [expanded, setExpanded] = useState(false)
  const [measures, setMeasures] = useState<Record<number, string>>({})
  const qc = useQueryClient()

  const configs = task.ordreMissionLigne?.articleAction?.measure_configs ?? []
  const om = task.ordreMissionLigne?.ordreMission
  const article = task.ordreMissionLigne?.article
  const action = task.ordreMissionLigne?.articleAction
  const type = om?.type ?? 'technicien'
  const typeMeta = TYPE_META[type] ?? TYPE_META.technicien
  const statut = STATUT_META[task.statut] ?? STATUT_META.todo

  const updateMut = useMutation({
    mutationFn: (body: Partial<MissionTask>) => missionTasksApi.update(task.id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['terrain-tasks'] }),
  })

  const submitMeasures = useMutation({
    mutationFn: () => {
      const measuresPayload = configs.map((c) => ({
        measure_config_id: c.id,
        value: measures[c.id] ?? '',
        value_numeric: c.field_type === 'number' && measures[c.id] !== ''
          ? Number(measures[c.id]) : undefined,
      }))
      return missionTasksApi.submitMeasures(task.id, measuresPayload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
      setExpanded(false)
    },
  })

  return (
    <div className="card" style={{ padding: '1rem', borderLeft: `4px solid ${typeMeta.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: typeMeta.color, background: typeMeta.bg }}>
              {typeMeta.label}
            </span>
            <span style={{ fontSize: '0.72rem', color: statut.color, fontWeight: 600 }}>{statut.label}</span>
            {om && (
              <Link to={`/ordres-mission/${om.id}`} className="link-inline" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                {om.numero}
              </Link>
            )}
            {om?.client && <span className="text-muted" style={{ fontSize: '0.82rem' }}>{om.client.name}</span>}
            {(om as any)?.site?.name && <span className="text-muted" style={{ fontSize: '0.82rem' }}>· {(om as any).site.name}</span>}
          </div>
          <div style={{ fontWeight: 600 }}>
            {article ? `${article.code} — ${article.libelle}` : '—'}
          </div>
          {action && <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{action.libelle}</div>}
          {task.planned_date && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              📅 {new Date(task.planned_date).toLocaleDateString('fr-FR')}
            </div>
          )}
          {task.assignedUser && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              👤 {task.assignedUser.name}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>
          {task.statut === 'todo' && (
            <button type="button" className="btn btn-primary btn-sm"
              onClick={() => updateMut.mutate({ statut: 'in_progress' })}
              disabled={updateMut.isPending}>
              ▶ Démarrer
            </button>
          )}
          {task.statut === 'in_progress' && (
            <>
              {configs.length > 0 && (
                <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => {
                    const existing: Record<number, string> = {}
                    for (const m of task.measures ?? []) {
                      existing[m.measure_config_id] = m.value_numeric != null ? String(m.value_numeric) : m.value ?? ''
                    }
                    setMeasures(existing)
                    setExpanded((v) => !v)
                  }}>
                  📋 {expanded ? 'Fermer' : 'Mesures'}
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => updateMut.mutate({ statut: 'done' })}
                disabled={updateMut.isPending}>
                ✓ Terminer
              </button>
            </>
          )}
          {task.is_conform === true && <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>✓ Conforme</span>}
          {task.is_conform === false && <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>✗ NC</span>}
        </div>
      </div>

      {expanded && configs.length > 0 && (
        <form
          style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)' }}
          onSubmit={(e) => { e.preventDefault(); submitMeasures.mutate() }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Mesures terrain — {configs.length} champ{configs.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
            {configs.slice().sort((a, b) => a.ordre - b.ordre).map((c) => (
              <MeasureInput
                key={c.id}
                config={c}
                value={measures[c.id] ?? ''}
                onChange={(v) => setMeasures((prev) => ({ ...prev, [c.id]: v }))}
              />
            ))}
          </div>
          {submitMeasures.isError && <p className="error" style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>{(submitMeasures.error as Error).message}</p>}
          <div className="crud-actions" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitMeasures.isPending}>
              {submitMeasures.isPending ? 'Envoi…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function TerrainTasksPage() {
  const [typeFilter, setTypeFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['terrain-tasks', typeFilter, statutFilter],
    queryFn: () => missionTasksApi.terrainBoard({
      type: typeFilter || undefined,
      statut: statutFilter || undefined,
    }),
    staleTime: 30_000,
  })

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Terrain', to: '/terrain' }, { label: 'Tâches' }]}
      moduleBarLabel="Terrain — Tâches"
      title="Tâches terrain"
      subtitle={`${tasks.length} tâche${tasks.length !== 1 ? 's' : ''}`}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
            <option value="">— Tous types —</option>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
            <option value="">— Tous statuts —</option>
            {Object.entries(STATUT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      }
    >
      {isLoading && <p className="text-muted">Chargement…</p>}

      {!isLoading && tasks.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucune tâche terrain.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {tasks.map((task) => <TerrainTaskCard key={task.id} task={task} />)}
      </div>
    </ModuleEntityShell>
  )
}
