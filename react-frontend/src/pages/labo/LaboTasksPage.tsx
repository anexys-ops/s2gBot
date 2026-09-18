/**
 * LaboTasksPage — Tâches laboratoire avec CRUD complet
 * Statuts, timing (démarrage/gel), validation responsable, suppression.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { missionTasksApi, type ActionMeasureConfig, type MissionTask } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'

const STATUT_META: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: 'À faire',    color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'En cours',   color: '#f59e0b', bg: '#fef3c7' },
  paused:      { label: 'En pause',   color: '#8b5cf6', bg: '#ede9fe' },
  frozen:      { label: 'Gelée',      color: '#0ea5e9', bg: '#e0f2fe' },
  done:        { label: 'Terminé',    color: '#3b82f6', bg: '#dbeafe' },
  validated:   { label: 'Validé',     color: '#10b981', bg: '#d1fae5' },
  rejected:    { label: 'Rejeté',     color: '#ef4444', bg: '#fee2e2' },
}

function fmtDatetime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function elapsed(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso.includes('T') ? fromIso : fromIso.replace(' ', 'T')).getTime()
  if (ms < 0) return ''
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`
  return `${m}min`
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

function MeasureField({ config, value, onChange }: {
  config: ActionMeasureConfig; value: string; onChange: (v: string) => void
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

function ValidateModal({ task, onClose }: { task: MissionTask; onClose: () => void }) {
  const [isConform, setIsConform] = useState<boolean | null>(null)
  const [conclusion, setConclusion] = useState('')
  const [observations, setObservations] = useState('')
  const qc = useQueryClient()

  const validateMut = useMutation({
    mutationFn: () => missionTasksApi.validate(task.id, {
      is_conform: isConform!,
      conclusion: conclusion || undefined,
      observations: observations || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['labo-tasks'] })
      onClose()
    },
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={onClose}>
      <div
        className="card"
        style={{ width: '100%', maxWidth: 480, padding: '1.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem' }}>Valider la tâche</h3>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>
            Conformité <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${isConform === true ? 'btn-primary' : 'btn-secondary'}`}
              style={isConform === true ? { background: '#10b981', borderColor: '#10b981' } : {}}
              onClick={() => setIsConform(true)}
            >
              ✓ Conforme
            </button>
            <button
              type="button"
              className={`btn btn-sm ${isConform === false ? 'btn-primary' : 'btn-secondary'}`}
              style={isConform === false ? { background: '#ef4444', borderColor: '#ef4444' } : {}}
              onClick={() => setIsConform(false)}
            >
              ✗ Non conforme
            </button>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>
            Conclusion
          </label>
          <input
            type="text"
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="Conclusion courte…"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>
            Observations
          </label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Observations détaillées…"
            rows={3}
            style={{ width: '100%' }}
          />
        </div>
        {validateMut.isError && (
          <p style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            Erreur lors de la validation.
          </p>
        )}
        <div className="crud-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => validateMut.mutate()}
            disabled={isConform === null || validateMut.isPending}
          >
            {validateMut.isPending ? 'Validation…' : '✓ Valider'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  void tick
  return <span style={{ color: '#f59e0b', fontWeight: 600 }}>{elapsed(startedAt)}</span>
}

function TaskCard({ task, canManage }: { task: MissionTask; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [measureValues, setMeasureValues] = useState<Record<number, string>>({})
  const [showValidate, setShowValidate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qc = useQueryClient()

  const configs = task.ordreMissionLigne?.articleAction?.measure_configs ?? []
  const statut = STATUT_META[task.statut] ?? STATUT_META.todo

  const updateMut = useMutation({
    mutationFn: (body: Partial<MissionTask>) => missionTasksApi.update(task.id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['labo-tasks'] }),
  })

  const deleteMut = useMutation({
    mutationFn: () => missionTasksApi.delete(task.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['labo-tasks'] }),
  })

  const rejectMut = useMutation({
    mutationFn: () => missionTasksApi.update(task.id, { statut: 'rejected' }),
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

  const existingValues: Record<number, string> = {}
  for (const m of task.measures ?? []) {
    existingValues[m.measure_config_id] = m.value_numeric != null
      ? String(m.value_numeric) : m.value ?? ''
  }

  const isActive = updateMut.isPending || rejectMut.isPending || deleteMut.isPending

  return (
    <>
      <div className="card" style={{ padding: '1rem', borderLeft: `4px solid ${statut.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Left: info */}
          <div style={{ flex: 1, minWidth: 0 }}>
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
            {action && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                {action.libelle} · {action.duree_heures}h estimé
              </div>
            )}

            {/* Dates et timing */}
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {task.planned_date && (
                <span>📅 Prévu : {new Date(task.planned_date).toLocaleDateString('fr-FR')}</span>
              )}
              {task.due_date && (
                <span>⏰ Échéance : {new Date(task.due_date).toLocaleDateString('fr-FR')}</span>
              )}
              {task.started_at && (
                <span>
                  ▶ Démarré : {fmtDatetime(task.started_at)}
                  {task.statut === 'in_progress' && (
                    <> · <ElapsedTimer startedAt={task.started_at} /></>
                  )}
                </span>
              )}
              {task.completed_at && (
                <span>✓ Terminé : {fmtDatetime(task.completed_at)}</span>
              )}
              {task.validated_at && (
                <span>🔒 Validé : {fmtDatetime(task.validated_at)}</span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* todo → in_progress */}
            {task.statut === 'todo' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => updateMut.mutate({ statut: 'in_progress' })}
                disabled={isActive}
              >
                ▶ Démarrer
              </button>
            )}

            {/* in_progress actions */}
            {task.statut === 'in_progress' && (
              <>
                {configs.length > 0 ? (
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
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => updateMut.mutate({ statut: 'done' })}
                    disabled={isActive}
                  >
                    ✓ Terminer
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => updateMut.mutate({ statut: 'paused' })}
                  disabled={isActive}
                  title="Mettre en pause"
                >
                  ⏸
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => updateMut.mutate({ statut: 'frozen' })}
                  disabled={isActive}
                  title="Geler la tâche"
                >
                  ❄
                </button>
              </>
            )}

            {/* paused → in_progress */}
            {task.statut === 'paused' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => updateMut.mutate({ statut: 'in_progress' })}
                disabled={isActive}
              >
                ▶ Reprendre
              </button>
            )}

            {/* frozen → in_progress */}
            {task.statut === 'frozen' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => updateMut.mutate({ statut: 'in_progress' })}
                disabled={isActive}
              >
                ▶ Dégeler
              </button>
            )}

            {/* done → validate / reject (responsable/lab_admin) */}
            {task.statut === 'done' && canManage && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                  onClick={() => setShowValidate(true)}
                  disabled={isActive}
                >
                  ✓ Valider
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => rejectMut.mutate()}
                  disabled={isActive}
                >
                  ✗ Rejeter
                </button>
              </>
            )}
            {task.statut === 'done' && !canManage && (
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>En attente validation</span>
            )}

            {/* Delete (responsable/lab_admin) */}
            {canManage && task.statut !== 'validated' && (
              confirmDelete ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
                    onClick={() => deleteMut.mutate()}
                    disabled={deleteMut.isPending}
                  >
                    {deleteMut.isPending ? '…' : 'Confirmer'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isActive}
                  title="Supprimer la tâche"
                  style={{ color: '#ef4444' }}
                >
                  🗑
                </button>
              )
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

      {showValidate && <ValidateModal task={task} onClose={() => setShowValidate(false)} />}
    </>
  )
}

export default function LaboTasksPage() {
  const { user } = useAuth()
  const [statutFilter, setStatutFilter] = useState('')
  const canManage = user?.role === 'lab_admin' || user?.role === 'responsable'

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['labo-tasks', statutFilter],
    queryFn: () => missionTasksApi.laboBoard({ statut: statutFilter || undefined }),
    staleTime: 30_000,
  })

  const byStatut = Object.fromEntries(
    Object.keys(STATUT_META).map((k) => [k, tasks.filter((t) => t.statut === k)])
  )

  const displayed = tasks.filter((t) => !statutFilter || t.statut === statutFilter)

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Laboratoire', to: '/labo' }, { label: 'Tâches labo' }]}
      moduleBarLabel="Laboratoire — Tâches"
      title="Tâches labo"
      subtitle={`${tasks.length} tâche${tasks.length !== 1 ? 's' : ''}`}
      actions={
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
          <option value="">— Tous statuts —</option>
          {Object.entries(STATUT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      }
    >
      {/* Compteurs par statut */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(STATUT_META).map(([k, meta]) => {
          const count = (byStatut[k] ?? []).length
          if (count === 0) return null
          return (
            <button
              key={k}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStatutFilter(statutFilter === k ? '' : k)}
              style={{
                borderColor: statutFilter === k ? meta.color : undefined,
                color: statutFilter === k ? meta.color : undefined,
                fontWeight: statutFilter === k ? 700 : undefined,
              }}
            >
              {meta.label} <strong style={{ marginLeft: 4 }}>{count}</strong>
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
        {displayed.map((task) => (
          <TaskCard key={task.id} task={task} canManage={canManage} />
        ))}
      </div>
    </ModuleEntityShell>
  )
}
