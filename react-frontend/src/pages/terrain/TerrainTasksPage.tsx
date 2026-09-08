/**
 * TerrainTasksPage
 *
 * Tableau de bord des tâches terrain (techniciens / ingénieurs).
 * Formulaires de mesures terrain, affectation, statuts + historique synthétique.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { missionTasksApi, type ActionMeasureConfig, type MissionTask } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import TerrainTasksHistoryPanel, { type TerrainHistoryGroupMode, taskDisplayName } from './TerrainTasksHistoryPanel'

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

function startedLabel(task: MissionTask): string {
  if (task.statut === 'in_progress') {
    return task.started_at
      ? `Démarrée le ${new Date(task.started_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
      : 'En cours'
  }
  if (task.statut === 'todo') return 'Non démarrée'
  if (task.statut === 'done') return 'Terminée'
  if (task.statut === 'validated') return 'Validée'
  if (task.statut === 'rejected') return 'Rejetée'
  return STATUT_META[task.statut]?.label ?? task.statut
}

function TerrainTaskRow({ task }: { task: MissionTask }) {
  const [expanded, setExpanded] = useState(false)
  const [measures, setMeasures] = useState<Record<number, string>>({})
  const qc = useQueryClient()

  const configs = task.ordreMissionLigne?.articleAction?.measure_configs ?? []
  const om = task.ordreMissionLigne?.ordreMission
  const dossier = om?.dossier ?? om?.bonCommande?.dossier
  const type = om?.type ?? 'technicien'
  const typeMeta = TYPE_META[type] ?? TYPE_META.technicien
  const statut = STATUT_META[task.statut] ?? STATUT_META.todo

  const updateMut = useMutation({
    mutationFn: (body: Partial<MissionTask>) => missionTasksApi.update(task.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
      void qc.invalidateQueries({ queryKey: ['terrain-tasks-history'] })
    },
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
      void qc.invalidateQueries({ queryKey: ['terrain-tasks-history'] })
      setExpanded(false)
    },
  })

  return (
    <>
      <tr className={expanded ? 'terrain-tasks-row--open' : undefined}>
        <td>
          {dossier ? (
            <Link to={`/dossiers/${dossier.id}`} className="link-inline">
              <strong>{dossier.reference}</strong>
            </Link>
          ) : (
            <span className="text-muted">—</span>
          )}
          {dossier?.titre && (
            <div className="text-muted terrain-tasks-table__sub">{dossier.titre}</div>
          )}
        </td>
        <td>
          {om?.client?.name ?? '—'}
          {om?.site?.name && <div className="text-muted terrain-tasks-table__sub">{om.site.name}</div>}
        </td>
        <td>
          <div className="terrain-tasks-table__task-name">{taskDisplayName(task)}</div>
          {om && (
            <Link to={`/ordres-mission/${om.id}`} className="link-inline terrain-tasks-table__sub">
              {om.numero}
            </Link>
          )}
        </td>
        <td>
          <span
            className="terrain-tasks-table__type"
            style={{ color: typeMeta.color, background: typeMeta.bg }}
          >
            {typeMeta.label}
          </span>
        </td>
        <td>{task.assignedUser?.name ?? <span className="text-muted">Non assigné</span>}</td>
        <td>
          <span className="terrain-tasks-table__statut" style={{ color: statut.color }}>
            {statut.label}
          </span>
          <div className="text-muted terrain-tasks-table__sub">{startedLabel(task)}</div>
        </td>
        <td className="terrain-tasks-table__actions">
          {task.statut === 'todo' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => updateMut.mutate({ statut: 'in_progress' })}
              disabled={updateMut.isPending}
            >
              Démarrer
            </button>
          )}
          {task.statut === 'in_progress' && (
            <div className="terrain-tasks-table__action-group">
              {configs.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const existing: Record<number, string> = {}
                    for (const m of task.measures ?? []) {
                      existing[m.measure_config_id] = m.value_numeric != null ? String(m.value_numeric) : m.value ?? ''
                    }
                    setMeasures(existing)
                    setExpanded((v) => !v)
                  }}
                >
                  {expanded ? 'Fermer' : 'Mesures'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => updateMut.mutate({ statut: 'done' })}
                disabled={updateMut.isPending}
              >
                Terminer
              </button>
            </div>
          )}
          {(task.statut === 'done' || task.statut === 'validated') && (
            <span className="text-muted">—</span>
          )}
        </td>
      </tr>
      {expanded && configs.length > 0 && (
        <tr className="terrain-tasks-detail">
          <td colSpan={7}>
            <form
              className="terrain-tasks-detail__form"
              onSubmit={(e) => { e.preventDefault(); submitMeasures.mutate() }}
            >
              <div className="terrain-tasks-detail__title">
                Mesures terrain — {taskDisplayName(task)}
              </div>
              <div className="terrain-tasks-detail__grid">
                {configs.slice().sort((a, b) => a.ordre - b.ordre).map((c) => (
                  <MeasureInput
                    key={c.id}
                    config={c}
                    value={measures[c.id] ?? ''}
                    onChange={(v) => setMeasures((prev) => ({ ...prev, [c.id]: v }))}
                  />
                ))}
              </div>
              {submitMeasures.isError && (
                <p className="error" style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
                  {(submitMeasures.error as Error).message}
                </p>
              )}
              <div className="crud-actions" style={{ marginTop: '0.75rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitMeasures.isPending}>
                  {submitMeasures.isPending ? 'Envoi…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}

export default function TerrainTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('vue') === 'historique' ? 'historique' : 'actives'

  const [typeFilter, setTypeFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [historyStatutFilter, setHistoryStatutFilter] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [groupMode, setGroupMode] = useState<TerrainHistoryGroupMode>('day')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['terrain-tasks', typeFilter, statutFilter],
    queryFn: () => missionTasksApi.terrainBoard({
      type: typeFilter || undefined,
      statut: statutFilter || undefined,
    }),
    staleTime: 30_000,
    enabled: view === 'actives',
  })

  const setView = (next: 'actives' | 'historique') => {
    if (next === 'historique') {
      setSearchParams({ vue: 'historique' })
    } else {
      setSearchParams({})
    }
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Terrain', to: '/terrain' }, { label: 'Tâches' }]}
      moduleBarLabel="Terrain — Tâches"
      title="Tâches terrain"
      subtitle={view === 'actives'
        ? `${tasks.length} tâche${tasks.length !== 1 ? 's' : ''}`
        : 'Vue synthétique — toutes les tâches terrain et ingénieur'}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="terrain-tasks-view-tabs" role="tablist" aria-label="Vue tâches terrain">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'actives'}
              className={`terrain-tasks-view-tab${view === 'actives' ? ' is-active' : ''}`}
              onClick={() => setView('actives')}
            >
              En cours
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'historique'}
              className={`terrain-tasks-view-tab${view === 'historique' ? ' is-active' : ''}`}
              onClick={() => setView('historique')}
            >
              Historique
            </button>
          </div>

          {view === 'actives' && (
            <>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
                <option value="">— Tous types —</option>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
                <option value="">— Tous statuts —</option>
                {Object.entries(STATUT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </>
          )}

          {view === 'historique' && (
            <>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
                <option value="">— Tous types —</option>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={historyStatutFilter} onChange={(e) => setHistoryStatutFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
                <option value="">— Tous statuts —</option>
                {Object.entries(STATUT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Rechercher…"
                style={{ fontSize: '0.85rem', minWidth: '10rem' }}
              />
              <input
                type="date"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
                aria-label="Date début"
                style={{ fontSize: '0.85rem' }}
              />
              <input
                type="date"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
                aria-label="Date fin"
                style={{ fontSize: '0.85rem' }}
              />
            </>
          )}
        </div>
      }
    >
      {view === 'actives' && (
        <>
          {isLoading && <p className="text-muted">Chargement…</p>}

          {!isLoading && tasks.length === 0 && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <p className="text-muted">Aucune tâche terrain.</p>
            </div>
          )}

          {!isLoading && tasks.length > 0 && (
            <div className="table-wrap">
              <table className="data-table data-table--compact terrain-tasks-table">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Client / chantier</th>
                    <th>Tâche</th>
                    <th>Type</th>
                    <th>Technicien</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => <TerrainTaskRow key={task.id} task={task} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === 'historique' && (
        <TerrainTasksHistoryPanel
          typeFilter={typeFilter}
          statutFilter={historyStatutFilter}
          search={historySearch}
          dateFrom={historyDateFrom}
          dateTo={historyDateTo}
          groupMode={groupMode}
          onGroupModeChange={setGroupMode}
        />
      )}
    </ModuleEntityShell>
  )
}
