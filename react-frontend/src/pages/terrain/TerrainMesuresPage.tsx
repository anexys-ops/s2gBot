/**
 * Mesures terrain — récapitulatif par dossier des tâches nécessitant des mesures,
 * avec accès à la saisie géotechnique, graphique ou data (app mobile / manuel).
 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  missionTasksApi,
  type ActionMeasureConfig,
  type MissionTask,
} from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { taskDisplayName } from './TerrainTasksHistoryPanel'
import {
  MESURE_STATUT_META,
  categorizeMeasureConfigs,
  displayMeasureStatut,
  dossierProgress,
  formatDate,
  formatDateTime,
  groupTasksByDossier,
  measureConfigs,
  measureProgress,
  type DossierMeasureRecap,
  type MeasureDisplayStatut,
} from './terrainMeasureUtils'

const TYPE_LABELS: Record<string, string> = {
  technicien: 'Technicien',
  ingenieur: 'Ingénieur',
}

function StatutBadge({ statut }: { statut: MeasureDisplayStatut }) {
  const meta = MESURE_STATUT_META[statut]
  return (
    <span
      className="terrain-mesures-statut"
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  )
}

function ProgressBar({ pct, complete }: { pct: number; complete?: boolean }) {
  return (
    <div className="terrain-mesures-progress">
      <div className="terrain-mesures-progress__track">
        <div
          className="terrain-mesures-progress__fill"
          style={{ width: `${pct}%`, background: complete ? '#10b981' : '#3b82f6' }}
        />
      </div>
      <span className="terrain-mesures-progress__label">{pct} %</span>
    </div>
  )
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
    <div className="terrain-mesures-field">
      <span className="terrain-mesures-field__label">
        {config.field_name}
        {config.is_required && <span className="terrain-mesures-field__req"> *</span>}
        {config.unit && <span className="text-muted terrain-mesures-field__unit">{config.unit}</span>}
      </span>
      {config.help_text && (
        <span className="text-muted terrain-mesures-field__help">{config.help_text}</span>
      )}
      {config.field_type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(config.select_options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : config.field_type === 'boolean' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : config.field_type === 'file' ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder ?? 'Chemin fichier / référence graphique'}
        />
      ) : (
        <input
          type={config.field_type === 'date' ? 'date' : config.field_type === 'number' ? 'number' : 'text'}
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ borderColor: isOutOfRange ? '#ef4444' : undefined }}
          placeholder={config.placeholder ?? ''}
        />
      )}
      {isOutOfRange && (
        <span className="terrain-mesures-field__error">
          Hors bornes [{config.min_value} – {config.max_value}]
        </span>
      )}
    </div>
  )
}

function MeasureSection({
  title,
  hint,
  configs,
  measures,
  editable,
  values,
  onChange,
}: {
  title: string
  hint: string
  configs: ActionMeasureConfig[]
  measures: MissionTask['measures']
  editable: boolean
  values: Record<number, string>
  onChange: (id: number, v: string) => void
}) {
  if (configs.length === 0) return null

  const byConfig = new Map((measures ?? []).map((m) => [m.measure_config_id, m]))

  return (
    <section className="terrain-mesures-section">
      <header className="terrain-mesures-section__head">
        <h3>{title}</h3>
        <p className="text-muted">{hint}</p>
      </header>
      <div className="terrain-mesures-section__grid">
        {configs.slice().sort((a, b) => a.ordre - b.ordre).map((c) => {
          const existing = byConfig.get(c.id)
          const readValue = existing?.value_numeric != null
            ? String(existing.value_numeric)
            : existing?.value ?? existing?.attachment_path ?? '—'
          const source = existing?.created_by ? 'Saisie manuelle / web' : existing ? 'Enregistré' : '—'

          if (!editable) {
            return (
              <div key={c.id} className="terrain-mesures-readonly">
                <span className="terrain-mesures-readonly__label">{c.field_name}</span>
                <strong>{readValue}</strong>
                {existing && (
                  <span className="text-muted terrain-mesures-readonly__meta">{source}</span>
                )}
              </div>
            )
          }

          return (
            <MeasureInput
              key={c.id}
              config={c}
              value={values[c.id] ?? ''}
              onChange={(v) => onChange(c.id, v)}
            />
          )
        })}
      </div>
    </section>
  )
}

function TaskMeasureDetail({ task, onClose }: { task: MissionTask; onClose: () => void }) {
  const [measures, setMeasures] = useState<Record<number, string>>(() => {
    const existing: Record<number, string> = {}
    for (const m of task.measures ?? []) {
      existing[m.measure_config_id] = m.value_numeric != null
        ? String(m.value_numeric)
        : m.value ?? m.attachment_path ?? ''
    }
    return existing
  })
  const [activeTab, setActiveTab] = useState<'geotechnique' | 'graphique' | 'data'>('geotechnique')
  const qc = useQueryClient()

  const configs = measureConfigs(task)
  const { geotechnique, graphique, data: dataFields } = categorizeMeasureConfigs(configs)
  const progress = measureProgress(task)
  const statut = displayMeasureStatut(task)
  const om = task.ordreMissionLigne?.ordreMission
  const editable = !['done', 'validated', 'rejected'].includes(task.statut)

  const updateMut = useMutation({
    mutationFn: (body: Partial<MissionTask>) => missionTasksApi.update(task.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['terrain-measures'] })
    },
  })

  const submitMeasures = useMutation({
    mutationFn: () => {
      const measuresPayload = configs.map((c) => ({
        measure_config_id: c.id,
        value: measures[c.id] ?? '',
        value_numeric: c.field_type === 'number' && measures[c.id] !== ''
          ? Number(measures[c.id]) : undefined,
        attachment_path: c.field_type === 'file' && measures[c.id] !== ''
          ? measures[c.id] : undefined,
      }))
      return missionTasksApi.submitMeasures(task.id, measuresPayload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['terrain-measures'] })
    },
  })

  return (
    <div className="card terrain-mesures-detail">
      <div className="terrain-mesures-detail__header">
        <div>
          <p className="terrain-mesures-detail__kicker">Tâche — mesures</p>
          <h2 style={{ margin: '0.25rem 0' }}>{taskDisplayName(task)}</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            {task.unique_number}
            {om?.numero && (
              <> · <Link to={`/ordres-mission/${om.id}`} className="link-inline">{om.numero}</Link></>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Retour au récap
        </button>
      </div>

      <div className="terrain-mesures-detail__meta">
        <StatutBadge statut={statut} />
        <ProgressBar pct={progress.pct} complete={progress.pct === 100} />
        <span className="text-muted">
          {progress.filled}/{progress.total} champs remplis
          {progress.required > 0 && ` (${progress.requiredFilled}/${progress.required} obligatoires)`}
        </span>
        {task.started_at && (
          <span className="text-muted">Démarrée {formatDateTime(task.started_at)}</span>
        )}
        {task.assignedUser && (
          <span className="text-muted">Technicien : {task.assignedUser.name}</span>
        )}
      </div>

      <div className="terrain-mesures-detail__actions">
        {task.statut === 'todo' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => updateMut.mutate({ statut: 'in_progress' })}
            disabled={updateMut.isPending}
          >
            Démarrer les mesures
          </button>
        )}
        {['in_progress', 'started'].includes(statut) && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => updateMut.mutate({ statut: 'paused' })}
              disabled={updateMut.isPending}
            >
              Pause
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => updateMut.mutate({ statut: 'frozen' })}
              disabled={updateMut.isPending}
            >
              Gel
            </button>
          </>
        )}
        {(task.statut === 'paused' || task.statut === 'frozen') && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => updateMut.mutate({ statut: 'in_progress' })}
            disabled={updateMut.isPending}
          >
            Reprendre
          </button>
        )}
        {['in_progress', 'paused', 'frozen'].includes(task.statut) && progress.requiredFilled >= progress.required && progress.required > 0 && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => updateMut.mutate({ statut: 'done' })}
            disabled={updateMut.isPending}
          >
            Terminer la tâche
          </button>
        )}
        {!['done', 'validated', 'rejected'].includes(task.statut) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => updateMut.mutate({ statut: 'rejected' })}
            disabled={updateMut.isPending}
          >
            Annuler
          </button>
        )}
      </div>

      <div className="terrain-mesures-tabs" role="tablist">
        {([
          ['geotechnique', 'Géotechnique', geotechnique.length],
          ['graphique', 'Graphiques & fichiers', graphique.length],
          ['data', 'Données (app / manuel)', dataFields.length],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`terrain-mesures-tab${activeTab === id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
            {count > 0 && <span className="terrain-mesures-tab__count">{count}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'geotechnique' && (
        <MeasureSection
          title="Mesures géotechniques"
          hint="Valeurs numériques, dates et contrôles de conformité — saisie terrain ou application mobile."
          configs={geotechnique}
          measures={task.measures}
          editable={editable}
          values={measures}
          onChange={(id, v) => setMeasures((prev) => ({ ...prev, [id]: v }))}
        />
      )}

      {activeTab === 'graphique' && (
        <MeasureSection
          title="Graphiques & pièces jointes"
          hint="Courbes, photos ou exports — envoyés depuis l'application mobile ou référencés manuellement."
          configs={graphique}
          measures={task.measures}
          editable={editable}
          values={measures}
          onChange={(id, v) => setMeasures((prev) => ({ ...prev, [id]: v }))}
        />
      )}

      {activeTab === 'data' && (
        <>
          <MeasureSection
            title="Données structurées"
            hint="Champs texte, listes et valeurs issues de l'application mobile ou saisie web."
            configs={dataFields}
            measures={task.measures}
            editable={editable}
            values={measures}
            onChange={(id, v) => setMeasures((prev) => ({ ...prev, [id]: v }))}
          />
          {om?.site?.id && (
            <p className="text-muted terrain-mesures-mobile-hint">
              Les soumissions depuis l'application mobile sont rattachées au chantier{' '}
              <Link to={`/sites/${om.site.id}`} className="link-inline">{om.site.name}</Link>
              {' '}(API <code>/api/mobile/dossiers/site/{om.site.id}</code>).
            </p>
          )}
        </>
      )}

      {editable && configs.length > 0 && (
        <form
          className="terrain-mesures-detail__form"
          onSubmit={(e) => { e.preventDefault(); submitMeasures.mutate() }}
        >
          {submitMeasures.isError && (
            <p className="error">{(submitMeasures.error as Error).message}</p>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitMeasures.isPending}>
            {submitMeasures.isPending ? 'Enregistrement…' : 'Enregistrer les mesures'}
          </button>
        </form>
      )}
    </div>
  )
}

function DossierRecapRow({
  recap,
  expanded,
  onToggle,
  selectedTaskId,
  onSelectTask,
}: {
  recap: DossierMeasureRecap
  expanded: boolean
  onToggle: () => void
  selectedTaskId: number | null
  onSelectTask: (id: number) => void
}) {
  const progress = dossierProgress(recap)
  const statuts = recap.tasks.map(displayMeasureStatut)
  const hasActive = statuts.some((s) => ['todo', 'started', 'in_progress', 'paused', 'frozen'].includes(s))

  return (
    <>
      <tr
        className={`terrain-mesures-row${expanded ? ' is-expanded' : ''}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      >
        <td>
          {recap.dossierId ? (
            <Link
              to={`/dossiers/${recap.dossierId}`}
              className="link-inline"
              onClick={(e) => e.stopPropagation()}
            >
              <strong>{recap.reference}</strong>
            </Link>
          ) : (
            <strong>{recap.reference}</strong>
          )}
          {recap.titre && <div className="text-muted terrain-mesures-table__sub">{recap.titre}</div>}
        </td>
        <td>{recap.client ?? '—'}</td>
        <td>{recap.site ?? '—'}</td>
        <td>
          <div>{formatDate(recap.dateDebut)}</div>
          {recap.dateFin && (
            <div className="text-muted terrain-mesures-table__sub">→ {formatDate(recap.dateFin)}</div>
          )}
        </td>
        <td>
          {progress.tasksDone}/{progress.tasksTotal} tâche{progress.tasksTotal !== 1 ? 's' : ''}
        </td>
        <td>
          <ProgressBar pct={progress.pct} complete={progress.pct === 100 && !hasActive} />
          <div className="text-muted terrain-mesures-table__sub">
            {progress.measuresFilled}/{progress.measuresTotal} mesures
          </div>
        </td>
        <td>
          <div className="terrain-mesures-statut-list">
            {[...new Set(statuts)].slice(0, 3).map((s) => (
              <StatutBadge key={s} statut={s} />
            ))}
          </div>
        </td>
        <td className="terrain-mesures-table__chevron">{expanded ? '▾' : '▸'}</td>
      </tr>

      {expanded && recap.tasks.map((task) => {
        const p = measureProgress(task)
        const statut = displayMeasureStatut(task)
        const om = task.ordreMissionLigne?.ordreMission
        const type = om?.type ?? 'technicien'

        return (
          <tr
            key={task.id}
            className={`terrain-mesures-task-row${selectedTaskId === task.id ? ' is-selected' : ''}`}
            onClick={() => onSelectTask(task.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTask(task.id) } }}
          >
            <td colSpan={2} className="terrain-mesures-task-row__indent">
              {taskDisplayName(task)}
              <div className="text-muted terrain-mesures-table__sub">{task.unique_number}</div>
            </td>
            <td>{TYPE_LABELS[type] ?? type}</td>
            <td>{formatDate(task.planned_date ?? task.due_date)}</td>
            <td>{task.assignedUser?.name ?? '—'}</td>
            <td>
              <ProgressBar pct={p.pct} complete={p.pct === 100} />
            </td>
            <td><StatutBadge statut={statut} /></td>
            <td className="terrain-mesures-table__chevron">→</td>
          </tr>
        )
      })}
    </>
  )
}

export default function TerrainMesuresPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTaskId = searchParams.get('tache') ? Number(searchParams.get('tache')) : null

  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['terrain-measures', search, statutFilter, typeFilter, dateFrom, dateTo],
    queryFn: () => missionTasksApi.terrainMeasuresBoard({
      search: search || undefined,
      statut: statutFilter || undefined,
      type: typeFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    staleTime: 30_000,
  })

  const dossiers = useMemo(() => groupTasksByDossier(tasks), [tasks])

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null),
    [tasks, selectedTaskId],
  )

  const stats = useMemo(() => {
    const allStatuts = tasks.map(displayMeasureStatut)
    return {
      dossiers: dossiers.length,
      tasks: tasks.length,
      enCours: allStatuts.filter((s) => ['started', 'in_progress', 'paused', 'frozen'].includes(s)).length,
      aFaire: allStatuts.filter((s) => s === 'todo').length,
      terminees: allStatuts.filter((s) => s === 'done' || s === 'validated').length,
    }
  }, [tasks, dossiers])

  const openTask = (taskId: number) => {
    setSearchParams({ tache: String(taskId) })
  }

  const closeTask = () => {
    setSearchParams({})
  }

  if (selectedTask) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Terrain', to: '/terrain' },
          { label: 'Mesures', to: '/terrain/mesures' },
          { label: taskDisplayName(selectedTask) },
        ]}
        moduleBarLabel="Terrain — Mesures"
        title="Mesures terrain"
        subtitle={selectedTask.ordreMissionLigne?.ordreMission?.dossier?.reference ?? 'Détail tâche'}
      >
        <TaskMeasureDetail task={selectedTask} onClose={closeTask} />
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Terrain', to: '/terrain' }, { label: 'Mesures' }]}
      moduleBarLabel="Terrain — Mesures"
      title="Mesures terrain"
      subtitle={`${stats.dossiers} dossier${stats.dossiers !== 1 ? 's' : ''} · ${stats.tasks} tâche${stats.tasks !== 1 ? 's' : ''} avec mesures`}
      actions={
        <div className="terrain-mesures-filters">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dossier, client, tâche…"
            aria-label="Rechercher"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">— Tous types —</option>
            <option value="technicien">Technicien</option>
            <option value="ingenieur">Ingénieur</option>
          </select>
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">— Tous statuts —</option>
            {Object.entries(MESURE_STATUT_META).map(([k, v]) => (
              <option key={k} value={k === 'started' ? 'todo' : k}>{v.label}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Date début" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Date fin" />
        </div>
      }
    >
      <div className="terrain-mesures-stats">
        <div className="terrain-mesures-stat-card">
          <span className="terrain-mesures-stat-card__value">{stats.aFaire}</span>
          <span className="terrain-mesures-stat-card__label">À faire</span>
        </div>
        <div className="terrain-mesures-stat-card">
          <span className="terrain-mesures-stat-card__value">{stats.enCours}</span>
          <span className="terrain-mesures-stat-card__label">En cours / pause / gel</span>
        </div>
        <div className="terrain-mesures-stat-card">
          <span className="terrain-mesures-stat-card__value">{stats.terminees}</span>
          <span className="terrain-mesures-stat-card__label">Terminées / validées</span>
        </div>
      </div>

      {isLoading && <p className="text-muted">Chargement…</p>}

      {!isLoading && dossiers.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucun dossier avec des tâches nécessitant des mesures.</p>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Les formulaires de mesure sont configurés sur les actions produit du catalogue.
          </p>
        </div>
      )}

      {!isLoading && dossiers.length > 0 && (
        <div className="table-wrap">
          <table className="data-table data-table--compact terrain-mesures-table">
            <thead>
              <tr>
                <th>Référence dossier</th>
                <th>Client</th>
                <th>Chantier</th>
                <th>Dates</th>
                <th>Tâches</th>
                <th>Mesures</th>
                <th>Statuts</th>
                <th aria-hidden style={{ width: '2rem' }} />
              </tr>
            </thead>
            <tbody>
              {dossiers.map((recap) => (
                <DossierRecapRow
                  key={recap.key}
                  recap={recap}
                  expanded={expandedKey === recap.key}
                  onToggle={() => setExpandedKey((k) => (k === recap.key ? null : recap.key))}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={openTask}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted terrain-mesures-footnote">
        Cliquez sur un dossier pour voir ses tâches, puis sur une tâche pour saisir les mesures
        (géotechnique, graphiques ou données — application mobile ou saisie manuelle).
        {' '}
        <Link to="/terrain/taches" className="link-inline">Vue tâches terrain →</Link>
      </p>
    </ModuleEntityShell>
  )
}
