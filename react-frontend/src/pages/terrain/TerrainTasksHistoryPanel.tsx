/**
 * Vue synthétique des tâches terrain terminées — regroupement par nom, dossier ou jour.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { missionTasksApi, type MissionTask } from '../../api/client'

export type TerrainHistoryGroupMode = 'name' | 'dossier' | 'day'

const STATUT_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  validated: 'Validé',
  rejected: 'Rejeté',
}

const TYPE_LABELS: Record<string, string> = {
  technicien: 'Technicien',
  ingenieur: 'Ingénieur',
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR')
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function taskReferenceDate(task: MissionTask): string | null {
  return task.completed_at ?? task.validated_at ?? task.planned_date ?? task.due_date ?? null
}

export function taskDisplayName(task: MissionTask): string {
  const ligne = task.ordreMissionLigne
  const article = ligne?.article
  const action = ligne?.articleAction
  if (article && action) return `${article.code} — ${action.libelle}`
  if (article) return `${article.code} — ${article.libelle}`
  if (ligne?.libelle) return ligne.libelle
  return 'Tâche sans libellé'
}

function taskDossierLabel(task: MissionTask): string {
  const dossier = task.ordreMissionLigne?.ordreMission?.dossier
  if (!dossier) return 'Sans dossier'
  return dossier.titre ? `${dossier.reference} — ${dossier.titre}` : dossier.reference
}

function groupKey(task: MissionTask, mode: TerrainHistoryGroupMode): string {
  switch (mode) {
    case 'name':
      return taskDisplayName(task)
    case 'dossier':
      return taskDossierLabel(task)
    case 'day': {
      const date = taskReferenceDate(task)
      return date ? formatDate(date) : 'Date inconnue'
    }
  }
}

function compareGroups(a: string, b: string, mode: TerrainHistoryGroupMode): number {
  if (mode === 'day') {
    const parse = (label: string) => {
      if (label === 'Date inconnue') return 0
      const [d, m, y] = label.split('/').map(Number)
      return new Date(y, m - 1, d).getTime()
    }
    return parse(b) - parse(a)
  }
  return a.localeCompare(b, 'fr')
}

function HistoryTaskRow({ task }: { task: MissionTask }) {
  const [open, setOpen] = useState(false)
  const om = task.ordreMissionLigne?.ordreMission
  const measures = task.measures ?? []

  return (
    <>
      <tr className={open ? 'terrain-history-row--open' : undefined}>
        <td>
          <button
            type="button"
            className="btn btn-secondary btn-sm terrain-history-row__toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Masquer le détail' : 'Afficher le détail'}
          >
            {open ? '−' : '+'}
          </button>
        </td>
        <td>
          <code>{task.unique_number ?? `#${task.id}`}</code>
        </td>
        <td>{taskDisplayName(task)}</td>
        <td>
          {om?.dossier ? (
            <Link to={`/dossiers/${om.dossier.id}`} className="link-inline">
              {om.dossier.reference}
            </Link>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td>{TYPE_LABELS[om?.type ?? ''] ?? om?.type ?? '—'}</td>
        <td>{task.assignedUser?.name ?? '—'}</td>
        <td>{STATUT_LABELS[task.statut] ?? task.statut}</td>
        <td>{formatDate(taskReferenceDate(task))}</td>
        <td>
          {task.is_conform === true && <span className="badge badge--ok">Conforme</span>}
          {task.is_conform === false && <span className="badge badge--danger">NC</span>}
          {task.is_conform == null && <span className="text-muted">—</span>}
        </td>
        <td>
          {om && (
            <Link to={`/ordres-mission/${om.id}`} className="link-inline">
              {om.numero}
            </Link>
          )}
        </td>
      </tr>
      {open && (
        <tr className="terrain-history-detail">
          <td colSpan={10}>
            <div className="terrain-history-detail__body">
              <dl className="terrain-history-detail__timeline">
                <div>
                  <dt>Démarrée</dt>
                  <dd>{formatDateTime(task.started_at)}</dd>
                </div>
                <div>
                  <dt>Terminée</dt>
                  <dd>{formatDateTime(task.completed_at)}</dd>
                </div>
                <div>
                  <dt>Validée</dt>
                  <dd>{formatDateTime(task.validated_at)}</dd>
                </div>
                {task.result?.validatedBy && (
                  <div>
                    <dt>Validé par</dt>
                    <dd>{task.result.validatedBy.name}</dd>
                  </div>
                )}
              </dl>

              {measures.length > 0 && (
                <div className="terrain-history-detail__measures">
                  <h4>Mesures enregistrées</h4>
                  <table className="data-table data-table--compact">
                    <thead>
                      <tr>
                        <th>Champ</th>
                        <th>Valeur</th>
                        <th>Conformité</th>
                        <th>Saisie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measures.map((m) => (
                        <tr key={m.id}>
                          <td>{m.measure_config?.field_name ?? `#${m.measure_config_id}`}</td>
                          <td>
                            {m.value_numeric != null ? m.value_numeric : m.value ?? '—'}
                            {m.measure_config?.unit ? ` ${m.measure_config.unit}` : ''}
                          </td>
                          <td>
                            {m.is_conform === true && '✓'}
                            {m.is_conform === false && '✗'}
                            {m.is_conform == null && '—'}
                          </td>
                          <td className="text-muted">{formatDateTime(m.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {task.result?.observations && (
                <p className="terrain-history-detail__notes">
                  <strong>Observations :</strong> {task.result.observations}
                </p>
              )}
              {task.notes && (
                <p className="terrain-history-detail__notes">
                  <strong>Notes :</strong> {task.notes}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

type Props = {
  typeFilter: string
  statutFilter: string
  search: string
  dateFrom: string
  dateTo: string
  groupMode: TerrainHistoryGroupMode
  onGroupModeChange: (mode: TerrainHistoryGroupMode) => void
}

export default function TerrainTasksHistoryPanel({
  typeFilter,
  statutFilter,
  search,
  dateFrom,
  dateTo,
  groupMode,
  onGroupModeChange,
}: Props) {
  const { data: tasks = [], isLoading, isError, error } = useQuery({
    queryKey: ['terrain-tasks-history', typeFilter, statutFilter, search, dateFrom, dateTo],
    queryFn: () =>
      missionTasksApi.terrainHistory({
        type: typeFilter || undefined,
        statut: statutFilter || undefined,
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    staleTime: 30_000,
  })

  const grouped = useMemo(() => {
    const map = new Map<string, MissionTask[]>()
    for (const task of tasks) {
      const key = groupKey(task, groupMode)
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    }

    return [...map.entries()]
      .sort(([a], [b]) => compareGroups(a, b, groupMode))
      .map(([label, items]) => ({
        label,
        items: [...items].sort((a, b) => {
          const da = taskReferenceDate(a)
          const db = taskReferenceDate(b)
          return (db ? new Date(db).getTime() : 0) - (da ? new Date(da).getTime() : 0)
        }),
        count: items.length,
      }))
  }, [tasks, groupMode])

  const totalTasks = tasks.length

  return (
    <div className="terrain-history-panel">
      <div className="terrain-history-panel__toolbar">
        <div className="terrain-history-panel__group-tabs" role="tablist" aria-label="Regrouper par">
          {([
            ['name', 'Par nom'],
            ['dossier', 'Par dossier'],
            ['day', 'Par jour'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={groupMode === mode}
              className={`terrain-history-panel__group-tab${groupMode === mode ? ' is-active' : ''}`}
              onClick={() => onGroupModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-muted terrain-history-panel__summary">
          {totalTasks} tâche{totalTasks !== 1 ? 's' : ''}
          {grouped.length > 0 && ` · ${grouped.length} groupe${grouped.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {isError && (
        <p className="error">
          Impossible de charger l&apos;historique : {(error as Error).message}
        </p>
      )}

      {isLoading && <p className="text-muted">Chargement de l&apos;historique…</p>}

      {!isLoading && !isError && totalTasks === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucune tâche terrain pour ces critères.</p>
          <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.5rem' }}>
            Les tâches apparaissent ici dès qu&apos;un ordre de mission terrain ou ingénieur a généré des mission tasks.
          </p>
        </div>
      )}

      {!isLoading && !isError && grouped.map((group) => (
        <section key={group.label} className="terrain-history-group card">
          <header className="terrain-history-group__head">
            <h3 className="terrain-history-group__title">{group.label}</h3>
            <span className="terrain-history-group__count">
              {group.count} tâche{group.count > 1 ? 's' : ''}
            </span>
          </header>
          <div className="table-wrap">
            <table className="data-table data-table--compact terrain-history-table">
              <thead>
                <tr>
                  <th aria-label="Détail" />
                  <th>TSK</th>
                  <th>Prestation</th>
                  <th>Dossier</th>
                  <th>Type</th>
                  <th>Technicien</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Conformité</th>
                  <th>OdM</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((task) => (
                  <HistoryTaskRow key={task.id} task={task} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
