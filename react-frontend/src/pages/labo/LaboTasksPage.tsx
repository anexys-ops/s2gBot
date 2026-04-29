/**
 * LaboTasksPage
 *
 * Tableau de bord des tâches laboratoire.
 * Laborantin voit ses tâches avec formulaires de mesures à remplir.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { missionTasksApi, type ActionMeasureConfig, type MissionTask } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
const STATUT_META: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: 'À faire',    color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'En cours',   color: '#f59e0b', bg: '#fef3c7' },
  done:        { label: 'Terminé',    color: '#3b82f6', bg: '#dbeafe' },
  validated:   { label: 'Validé',     color: '#10b981', bg: '#d1fae5' },
  rejected:    { label: 'Rejeté',     color: '#ef4444', bg: '#fee2e2' },
}

function ConformBadge({ value }: { value?: boolean | null }) {
  if (value === null || value === undefined) return null
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      color: value ? '#10b981' : '#ef4444',
      background: value ? '#d1fae5' : '#fee2e2',
    }}>
      {value ? '✓ Conforme' : '✗ NC'}
    </span>
  )
}

function MeasureField({
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

  const hint = config.field_type === 'number' && (config.min_value != null || config.max_value != null)
    ? `[${config.min_value ?? '…'} – ${config.max_value ?? '…'} ${config.unit ?? ''}]`
    : config.unit ?? ''

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
      <span>
        {config.field_name}
        {config.is_required && <span style={{ color: '#ef4444' }}> *</span>}
        {hint && <span className="text-muted" style={{ marginLeft: 4, fontSize: '0.75rem' }}>{hint}</span>}
      </span>
      {config.field_type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choisir…</option>
          {(config.select_options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : config.field_type === 'boolean' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : config.field_type === 'date' ? (
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : config.field_type === 'file' ? (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Chemin ou URL fichier" />
      ) : (
        <input
          type="number" step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder ?? ''}
          style={{ borderColor: isOutOfRange ? '#ef4444' : undefined }}
        />
      )}
      {isOutOfRange && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>Hors bornes attendues</span>}
      {config.help_text && <span className="text-muted" style={{ fontSize: '0.75rem' }}>{config.help_text}</span>}
    </label>
  )
}

function TaskCard({ task }: { task: MissionTask }) {
  const [expanded, setExpanded] = useState(false)
  const [measureValues, setMeasureValues] = useState<Record<number, string>>({})
  const qc = useQueryClient()

  const configs = task.ordreMissionLigne?.articleAction?.measure_configs ?? []
  const statut = STATUT_META[task.statut] ?? STATUT_META.todo

  const updateMut = useMutation({
    mutationFn: (body: Partial<MissionTask>) => missionTasksApi.update(task.id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['labo-tasks'] }),
  })

  const submitMeasures = useMutation({
    mutationFn: () => {
      const measures = configs.map((c) => ({
        measure_config_id: c.id,
        value: measureValues[c.id] ?? '',
        value_numeric: c.field_type === 'number' && measureValues[c.id] !== ''
          ? Number(measureValues[c.id]) : undefined,
      }))
      return missionTasksApi.submitMeasures(task.id, measures)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['labo-tasks'] })
      setExpanded(false)
    },
  })

  const om = task.ordreMissionLigne?.ordreMission
  const article = task.ordreMissionLigne?.article
  const action = task.ordreMissionLigne?.articleAction

  // Pré-remplir avec valeurs existantes
  const existingValues: Record<number, string> = {}
  for (const m of task.measures ?? []) {
    existingValues[m.measure_config_id] = m.value_numeric != null
      ? String(m.value_numeric) : m.value ?? ''
  }

  return (
    <div className="card" style={{ padding: '1rem', borderLeft: `4px solid ${statut.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              color: statut.color, background: statut.bg,
            }}>
              {statut.label}
            </span>
            {om && (
              <Link to={`/ordres-mission/${om.id}`} className="link-inline" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                {om.numero}
              </Link>
            )}
            {om?.client && <span className="text-muted" style={{ fontSize: '0.82rem' }}>{om.client.name}</span>}
            <ConformBadge value={task.is_conform} />
          </div>
          <div style={{ marginTop: '0.25rem', fontWeight: 600 }}>
            {article ? `${article.code} — ${article.libelle}` : '—'}
          </div>
          {action && <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{action.libelle} · {action.duree_heures}h estimé</div>}
          {(task.planned_date || task.due_date) && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              {task.planned_date && `Prévu : ${new Date(task.planned_date).toLocaleDateString('fr-FR')}`}
              {task.due_date && ` · Échéance : ${new Date(task.due_date).toLocaleDateString('fr-FR')}`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
          {task.statut === 'todo' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => updateMut.mutate({ statut: 'in_progress' })}
              disabled={updateMut.isPending}
            >
              ▶ Démarrer
            </button>
          )}
          {task.statut === 'in_progress' && configs.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setMeasureValues(existingValues)
                setExpanded((v) => !v)
              }}
            >
              📋 {expanded ? 'Fermer' : 'Saisir mesures'}
            </button>
          )}
          {task.statut === 'done' && (
            <span className="text-muted" style={{ fontSize: '0.82rem' }}>En attente validation</span>
          )}
        </div>
      </div>

      {/* Formulaire de mesures */}
      {expanded && configs.length > 0 && (
        <form
          style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)' }}
          onSubmit={(e) => {
            e.preventDefault()
            submitMeasures.mutate()
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Formulaire de mesures — {configs.length} champ{configs.length > 1 ? 's' : ''}
          </div>
          <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {configs.slice().sort((a, b) => a.ordre - b.ordre).map((c) => (
              <MeasureField
                key={c.id}
                config={c}
                value={measureValues[c.id] ?? ''}
                onChange={(v) => setMeasureValues((prev) => ({ ...prev, [c.id]: v }))}
              />
            ))}
          </div>

          {/* Mesures existantes pour référence */}
          {(task.measures ?? []).length > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Dernières saisies : {task.measures!.map((m) => (
                <span key={m.id} style={{ marginRight: 8 }}>
                  <strong>{m.measure_config?.field_name}</strong> : {m.value_numeric ?? m.value}
                  {m.is_conform === true && ' ✓'}
                  {m.is_conform === false && ' ✗'}
                </span>
              ))}
            </div>
          )}

          <div className="crud-actions" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitMeasures.isPending}>
              {submitMeasures.isPending ? 'Enregistrement…' : 'Enregistrer les mesures'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => updateMut.mutate({ statut: 'done' })}
              disabled={updateMut.isPending}
            >
              ✓ Marquer terminé
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function LaboTasksPage() {
  const [statutFilter, setStatutFilter] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['labo-tasks', statutFilter],
    queryFn: () => missionTasksApi.laboBoard({ statut: statutFilter || undefined }),
    staleTime: 30_000,
  })

  const byStatut = {
    todo:        tasks.filter((t) => t.statut === 'todo'),
    in_progress: tasks.filter((t) => t.statut === 'in_progress'),
    done:        tasks.filter((t) => t.statut === 'done'),
    validated:   tasks.filter((t) => t.statut === 'validated'),
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Laboratoire', to: '/labo' }, { label: 'Tâches' }]}
      moduleBarLabel="Laboratoire — Tâches"
      title="Tâches laboratoire"
      subtitle={`${tasks.length} tâche${tasks.length !== 1 ? 's' : ''}`}
      actions={
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
          <option value="">— Tous statuts —</option>
          {Object.entries(STATUT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      }
    >
      {/* Compteurs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(byStatut).map(([k, list]) => {
          const meta = STATUT_META[k]
          return (
            <button
              key={k}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStatutFilter(statutFilter === k ? '' : k)}
              style={{ borderColor: statutFilter === k ? meta.color : undefined, color: statutFilter === k ? meta.color : undefined }}
            >
              {meta.label} <strong style={{ marginLeft: 4 }}>{list.length}</strong>
            </button>
          )
        })}
      </div>

      {isLoading && <p className="text-muted">Chargement…</p>}

      {!isLoading && tasks.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucune tâche laboratoire.</p>
          <p style={{ fontSize: '0.85rem' }}>Les tâches sont générées automatiquement depuis les ordres de mission.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {tasks
          .filter((t) => !statutFilter || t.statut === statutFilter)
          .map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
    </ModuleEntityShell>
  )
}
