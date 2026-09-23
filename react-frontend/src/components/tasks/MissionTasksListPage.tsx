import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { missionTasksApi, planningTerrainApi, taskTestFormsApi, type MissionTask } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../module/ModuleEntityShell'
import Modal from '../Modal'
import { TASK_FILTERS, getTaskStatutMeta } from '../../lib/missionTaskStatuts'
import { dateInputFromApi, formatAppDate } from '../../lib/appLocale'
import { formatTechnicienOption } from '../../lib/userRolePresentation'

export type MissionTasksContext = 'labo' | 'terrain' | 'ingenieur'

const CONTEXT_META: Record<MissionTasksContext, {
  title: string
  moduleBarLabel: string
  parentLabel: string
  parentTo: string
  type: 'labo' | 'technicien' | 'ingenieur'
}> = {
  labo: {
    title: 'Tâches laboratoire',
    moduleBarLabel: 'Laboratoire — Tâches',
    parentLabel: 'Laboratoire',
    parentTo: '/labo',
    type: 'labo',
  },
  terrain: {
    title: 'Tâches terrain',
    moduleBarLabel: 'Terrain — Tâches',
    parentLabel: 'Terrain',
    parentTo: '/terrain',
    type: 'technicien',
  },
  ingenieur: {
    title: 'Tâches ingénieur',
    moduleBarLabel: 'Ingénierie — Tâches',
    parentLabel: 'Ingénierie',
    parentTo: '/ingenierie/odm',
    type: 'ingenieur',
  },
}

export function taskFilterKey(statut: MissionTask['statut']): string {
  return statut === 'paused' ? 'in_progress' : statut
}

export function taskReferenceDate(task: Pick<MissionTask, 'planned_date' | 'due_date'>): string {
  return dateInputFromApi(task.planned_date ?? task.due_date) || ''
}

export function taskDelayDays(
  task: Pick<MissionTask, 'statut' | 'planned_date' | 'due_date'>,
  today = new Date(),
): number | null {
  if (['done', 'validated', 'rejected'].includes(task.statut)) return null
  const date = taskReferenceDate(task)
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  const planned = new Date(year, month - 1, day)
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.floor((current.getTime() - planned.getTime()) / 86_400_000)
  return days > 0 ? days : 0
}

export function normalizePvNumbers(values: string | string[]): string[] {
  const entries = (Array.isArray(values) ? values : [values])
    .flatMap((value) => value.split(/[\n,;]+/))
    .map((value) => value.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  return entries.filter((value) => {
    const key = value.toLocaleLowerCase('fr')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function taskQuantityUnit(task: MissionTask, context: MissionTasksContext): { value: string; source: string } {
  const taskUnit = task.quantity_unit?.trim()
  if (taskUnit) return { value: taskUnit, source: 'Tâche' }

  const articleUnit = task.ordreMissionLigne?.article?.unite?.trim()
  if (articleUnit) return { value: articleUnit, source: 'Produit' }

  return context === 'labo'
    ? { value: 'echantillon', source: 'Valeur par défaut' }
    : { value: 'point', source: 'Valeur par défaut' }
}

function taskLabel(task: MissionTask): string {
  const ligne = task.ordreMissionLigne
  return ligne?.articleAction?.libelle || ligne?.libelle || ligne?.article?.libelle || 'Tâche sans libellé'
}

type TaskJalonGroup = { key: string; label: string; tasks: MissionTask[] }
type TaskDossierGroup = {
  key: string
  reference: string
  client: string
  site: string
  jalons: TaskJalonGroup[]
  count: number
}

function groupTasksByDossierAndJalon(tasks: MissionTask[]): TaskDossierGroup[] {
  const dossiers = new Map<string, TaskDossierGroup>()
  for (const task of tasks) {
    const om = task.ordreMissionLigne?.ordreMission
    const dossier = om?.dossier ?? om?.bonCommande?.dossier
    const dossierId = om?.dossier_id ?? om?.bonCommande?.dossier_id
    const dossierKey = dossierId ? `dossier-${dossierId}` : `om-${om?.id ?? task.id}`
    let group = dossiers.get(dossierKey)
    if (!group) {
      group = {
        key: dossierKey,
        reference: dossier?.reference ?? (om ? `Sans dossier · ${om.numero}` : 'Sans dossier'),
        client: om?.client?.name ?? 'Client non renseigné',
        site: om?.site?.name ?? 'Chantier non renseigné',
        jalons: [],
        count: 0,
      }
      dossiers.set(dossierKey, group)
    }
    const jalon = task.jalon_context
    const jalonKey = jalon?.id || jalon?.label || 'sans-jalon'
    let jalonGroup = group.jalons.find((item) => item.key === jalonKey)
    if (!jalonGroup) {
      jalonGroup = {
        key: jalonKey,
        label: jalon ? `${jalon.code ? `${jalon.code} — ` : ''}${jalon.label}` : 'Tâches sans jalon',
        tasks: [],
      }
      group.jalons.push(jalonGroup)
    }
    jalonGroup.tasks.push(task)
    group.count += 1
  }
  return [...dossiers.values()]
    .sort((a, b) => a.reference.localeCompare(b.reference, 'fr', { numeric: true }))
    .map((group) => ({
      ...group,
      jalons: group.jalons.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true })),
    }))
}

function DelayCell({ task }: { task: MissionTask }) {
  const date = taskReferenceDate(task)
  if (!date) return <span className="text-muted">Non programmée</span>
  if (['done', 'validated', 'rejected'].includes(task.statut)) {
    return <span className="text-muted">—</span>
  }
  const delay = taskDelayDays(task)
  if (delay && delay > 0) {
    return <span className="mission-task-list__delay mission-task-list__delay--late">+{delay} jour{delay > 1 ? 's' : ''}</span>
  }
  return <span className="mission-task-list__delay mission-task-list__delay--ok">Dans les délais</span>
}

function TaskEditModal({ task, context, onClose }: { task: MissionTask; context: MissionTasksContext; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const om = task.ordreMissionLigne?.ordreMission
  const [assignedUserId, setAssignedUserId] = useState(task.assigned_user_id ? String(task.assigned_user_id) : '')
  const [plannedDate, setPlannedDate] = useState(taskReferenceDate(task))
  const [statut, setStatut] = useState(task.statut)
  const [pvNumbers, setPvNumbers] = useState(() => normalizePvNumbers(task.pv_numbers ?? []))
  const [pvDraft, setPvDraft] = useState('')
  const quantityUnit = taskQuantityUnit(task, context)
  const [quantityCount, setQuantityCount] = useState(String(task.quantity_count ?? Math.min(1, task.remaining_quantity ?? 1)))
  const [message, setMessage] = useState('')
  const [correctionNotes, setCorrectionNotes] = useState<Record<number, string>>({})

  const { data: taskForms } = useQuery({
    queryKey: ['task-test-forms', task.id],
    queryFn: () => taskTestFormsApi.list(task.id),
  })
  const review = useMutation({
    mutationFn: ({ typeId, decision, correctionNote }: { typeId: number; decision: 'validate' | 'correction'; correctionNote?: string }) =>
      taskTestFormsApi.review(task.id, typeId, decision, correctionNote),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['task-test-forms', task.id] })
      await queryClient.invalidateQueries({ queryKey: ['mission-tasks-list', context] })
      setMessage('Formulaire mis à jour.')
    },
  })

  const openFormPhoto = async (photoId: number) => {
    try {
      const blob = await taskTestFormsApi.photo(photoId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const addPvNumbers = () => {
    const next = normalizePvNumbers([...pvNumbers, pvDraft])
    setPvNumbers(next)
    setPvDraft('')
    return next
  }

  const { data: technicians = [] } = useQuery({
    queryKey: ['task-technicians', context],
    queryFn: () => planningTerrainApi.techniciens(context),
    staleTime: 60_000,
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mission-tasks-list', context] })
    await queryClient.invalidateQueries({ queryKey: ['mission-tasks'] })
  }

  const save = useMutation({
    mutationFn: () => missionTasksApi.update(task.id, {
      assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
      planned_date: plannedDate || null,
      statut,
    }),
    onSuccess: async () => { await refresh(); onClose() },
  })

  const closeReception = useMutation({
    mutationFn: () => missionTasksApi.closeReception(task.id, {
      pv_numbers: normalizePvNumbers([...pvNumbers, pvDraft]),
      quantity_unit: quantityUnit.value,
      quantity_count: Number(quantityCount),
    }),
    onSuccess: async (result) => {
      await refresh()
      setMessage(`${result.samples_created || task.quantity_count || 0} étiquette(s) transmise(s), en attente de réception au laboratoire.`)
    },
  })

  const duplicate = useMutation({
    mutationFn: () => missionTasksApi.duplicate(task.id),
    onSuccess: async () => {
      await refresh()
      setMessage('Nouvelle tâche ajoutée sur le reliquat du bon de commande.')
    },
  })

  const error = save.error || closeReception.error || duplicate.error
  const pvCount = normalizePvNumbers([...pvNumbers, pvDraft]).length
  const maxQuantity = task.reception_generated_at ? (task.quantity_count ?? 1) : (task.remaining_quantity ?? task.ordered_quantity ?? 1)

  return (
    <Modal title={`${task.unique_number ?? `Tâche ${task.id}`} — ${taskLabel(task)}`} onClose={onClose} size="wide">
      {task.jalon_context ? <p className="mission-task-modal__jalon">Jalon : {task.jalon_context.label}</p> : null}
      <div className="mission-task-modal__grid">
        <label>Technicien assigné
          <select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
            <option value="">Non assigné</option>
            {technicians.map((technician) => <option key={technician.id} value={technician.id}>{formatTechnicienOption(technician)}</option>)}
          </select>
        </label>
        <label>Date programmée
          <input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} />
        </label>
        <label>Statut
          <select value={statut} onChange={(event) => setStatut(event.target.value as MissionTask['statut'])}>
            {TASK_FILTERS.flatMap((filter) => filter.statuts).filter((value, index, all) => all.indexOf(value) === index).map((value) => (
              <option key={value} value={value}>{getTaskStatutMeta(value as MissionTask['statut']).label}</option>
            ))}
          </select>
        </label>
        <label>Unité de quantité
          <span className="mission-task-modal__unit">
            <strong>{quantityUnit.value}</strong>
            <small>{quantityUnit.source}</small>
          </span>
        </label>
        <label>Nombre d’étiquettes
          <input type="number" min={1} max={maxQuantity} value={quantityCount} onChange={(event) => setQuantityCount(event.target.value)} disabled={Boolean(task.reception_generated_at)} />
          <span className="text-muted">Commandé : {task.ordered_quantity ?? '—'} · Déjà réceptionné : {task.received_quantity ?? 0} · Reliquat : {task.remaining_quantity ?? '—'}</span>
        </label>
        <label className="mission-task-modal__pv">Numéro(s) de PV
          {pvNumbers.length > 0 ? (
            <span className="mission-task-modal__badges" aria-label="Numéros de PV ajoutés">
              {pvNumbers.map((pv) => (
                <span key={pv.toLocaleLowerCase('fr')} className="mission-task-modal__badge">
                  {pv}
                  {!task.reception_generated_at ? (
                    <button type="button" aria-label={`Supprimer le PV ${pv}`} onClick={() => setPvNumbers((current) => current.filter((value) => value !== pv))}>×</button>
                  ) : null}
                </span>
              ))}
            </span>
          ) : null}
          {!task.reception_generated_at ? (
            <span className="mission-task-modal__pv-entry">
              <input
                type="text"
                value={pvDraft}
                onChange={(event) => setPvDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                    event.preventDefault()
                    addPvNumbers()
                  }
                }}
                onBlur={() => { if (pvDraft.trim()) addPvNumbers() }}
                placeholder="Saisir un numéro de PV"
              />
              <button type="button" className="btn btn--secondary" disabled={!pvDraft.trim()} onMouseDown={(event) => event.preventDefault()} onClick={addPvNumbers}>Ajouter</button>
            </span>
          ) : null}
          <span className="text-muted">{pvCount} numéro{pvCount !== 1 ? 's' : ''} de PV saisi{pvCount !== 1 ? 's' : ''}</span>
        </label>
      </div>
      {taskForms?.forms?.length ? <section className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
        <h3>Formulaires d’essai liés à cette tâche</h3>
        {taskForms.forms.map((form) => <div key={form.test_type.id} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
          <strong>{form.test_type.name}</strong> · {form.submission?.status ?? 'À remplir'}
          {form.submission?.correction_note ? <p>Correction demandée : {form.submission.correction_note}</p> : null}
          {form.submission ? <dl>{form.form_fields.filter((field) => field.type !== 'photo').map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{String(form.submission?.answers?.[field.key] ?? '—')}{field.unit ? ` ${field.unit}` : ''}</dd></div>)}</dl> : null}
          {form.submission?.photos?.map((photo) => <button key={photo.id} type="button" className="btn btn-secondary btn-sm" onClick={() => void openFormPhoto(photo.id)}>Voir la photo : {photo.original_name}</button>)}
          {(user?.role === 'lab_admin' || user?.role === 'responsable') && user?.id !== task.assigned_user_id && form.submission?.status === 'submitted' ? <div className="crud-actions">
            <input placeholder="Motif de correction" value={correctionNotes[form.test_type.id] ?? ''} onChange={(event) => setCorrectionNotes((current) => ({ ...current, [form.test_type.id]: event.target.value }))} />
            <button type="button" className="btn btn-secondary btn-sm" disabled={review.isPending || !(correctionNotes[form.test_type.id] ?? '').trim()} onClick={() => review.mutate({ typeId: form.test_type.id, decision: 'correction', correctionNote: correctionNotes[form.test_type.id] })}>Demander correction</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={review.isPending} onClick={() => review.mutate({ typeId: form.test_type.id, decision: 'validate' })}>Valider le formulaire</button>
          </div> : null}
        </div>)}
        {review.isError ? <p className="error">{(review.error as Error).message}</p> : null}
      </section> : null}
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}
      <div className="mission-task-modal__actions">
        {om ? <button type="button" className="btn btn--secondary" onClick={() => navigate(`/ordres-mission/${om.id}`)}>Ouvrir l’OM</button> : null}
        {(task.remaining_quantity ?? 0) > 0 && task.reception_generated_at ? <button type="button" className="btn btn--secondary" disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>Ajouter une tâche sur le reliquat</button> : null}
        <button type="button" className="btn btn--secondary" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</button>
        <button type="button" className="btn btn--primary" disabled={closeReception.isPending || pvCount === 0 || Number(quantityCount) < 1 || Boolean(task.reception_generated_at)} onClick={() => closeReception.mutate()}>
          {task.reception_generated_at ? 'Réception déjà générée' : 'Clôturer et préparer les étiquettes'}
        </button>
      </div>
    </Modal>
  )
}

export default function MissionTasksListPage({ context }: { context: MissionTasksContext }) {
  const meta = CONTEXT_META[context]
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedTask, setSelectedTask] = useState<MissionTask | null>(null)

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['mission-tasks-list', context],
    queryFn: () => context === 'labo'
      ? missionTasksApi.laboBoard()
      : missionTasksApi.terrainBoard({ type: meta.type }),
    staleTime: 30_000,
  })

  useEffect(() => {
    const requestedTaskId = Number(searchParams.get('task'))
    if (!requestedTaskId || selectedTask?.id === requestedTaskId) return
    const requestedTask = tasks.find((task) => task.id === requestedTaskId)
    if (requestedTask) setSelectedTask(requestedTask)
  }, [searchParams, selectedTask, tasks])

  const closeTaskModal = () => {
    setSelectedTask(null)
    if (!searchParams.has('task')) return
    const next = new URLSearchParams(searchParams)
    next.delete('task')
    setSearchParams(next, { replace: true })
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const filter of TASK_FILTERS) {
      const statuts: readonly string[] = filter.statuts
      result[filter.key] = tasks.filter((task) => statuts.includes(task.statut)).length
    }
    return result
  }, [tasks])

  const clients = useMemo(() => [...new Map(tasks.flatMap((task) => {
    const client = task.ordreMissionLigne?.ordreMission?.client
    return client ? [[client.id, client.name] as const] : []
  })).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr')), [tasks])
  const technicians = useMemo(() => [...new Map(tasks.flatMap((task) => {
    const technician = task.assignedUser
    return technician ? [[technician.id, technician.name] as const] : []
  })).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr')), [tasks])

  const displayed = useMemo(() => tasks.filter((task) => {
    if (statusFilter && taskFilterKey(task.statut) !== statusFilter) return false
    const om = task.ordreMissionLigne?.ordreMission
    const dossier = om?.dossier ?? om?.bonCommande?.dossier
    if (clientFilter && String(om?.client?.id ?? '') !== clientFilter) return false
    if (technicianFilter && String(task.assigned_user_id ?? '') !== technicianFilter) return false
    const date = taskReferenceDate(task)
    if (dateFrom && (!date || date < dateFrom)) return false
    if (dateTo && (!date || date > dateTo)) return false
    const query = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
    if (!query) return true
    const searchable = [
      task.unique_number, taskLabel(task), task.jalon_context?.code, task.jalon_context?.label,
      task.assignedUser?.name, om?.numero, om?.client?.name, om?.site?.name,
      dossier?.reference, dossier?.titre, date, date ? formatAppDate(date) : '',
    ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
    return searchable.includes(query)
  }), [tasks, statusFilter, clientFilter, technicianFilter, dateFrom, dateTo, search])
  const grouped = useMemo(() => groupTasksByDossierAndJalon(displayed), [displayed])

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: meta.parentLabel, to: meta.parentTo },
        { label: meta.title },
      ]}
      moduleBarLabel={meta.moduleBarLabel}
      title={meta.title}
      subtitle={`${displayed.length} tâche${displayed.length !== 1 ? 's' : ''} affichée${displayed.length !== 1 ? 's' : ''}`}
    >
      <section className="card mission-task-list__filters" aria-label="Filtres par statut">
        <button
          type="button"
          className={`mission-task-list__filter${statusFilter === '' ? ' is-active' : ''}`}
          aria-pressed={statusFilter === ''}
          onClick={() => setStatusFilter('')}
        >
          Tous <strong>{tasks.length}</strong>
        </button>
        {TASK_FILTERS.map((filter) => {
          const selected = statusFilter === filter.key
          const color = getTaskStatutMeta(filter.key)
          return (
            <button
              key={filter.key}
              type="button"
              className={`mission-task-list__filter${selected ? ' is-active' : ''}`}
              aria-pressed={selected}
              style={{
                borderColor: color.color,
                background: selected ? color.color : color.bg,
                color: selected ? '#fff' : color.color,
              }}
              onClick={() => setStatusFilter(selected ? '' : filter.key)}
            >
              {filter.label} <strong>{counts[filter.key] ?? 0}</strong>
            </button>
          )
        })}
      </section>

      <section className="card mission-task-list__search-filters" aria-label="Rechercher des tâches">
        <label className="mission-task-list__search-field">Recherche
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tâche, dossier, client, chantier, jalon…" />
        </label>
        <label>Client
          <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="">Tous les clients</option>
            {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>Technicien
          <select value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>
            <option value="">Tous les techniciens</option>
            {technicians.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>Du <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>Au <input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
          setSearch(''); setClientFilter(''); setTechnicianFilter(''); setDateFrom(''); setDateTo(''); setStatusFilter('')
        }}>Effacer les filtres</button>
      </section>

      {isLoading ? <p className="text-muted">Chargement…</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}

      {!isLoading && !error ? (
        <div className="card mission-task-list__table-card">
          <div className="table-wrap">
            <table className="data-table data-table--compact mission-task-list__table">
              <thead>
                <tr>
                  <th>N° tâche</th>
                  <th>Tâche</th>
                  <th>Technicien assigné</th>
                  <th>Statut</th>
                  <th>Date programmée</th>
                  <th>Retard</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={6} className="text-muted">Aucune tâche pour ce filtre.</td></tr>
                ) : null}
                {grouped.flatMap((dossier) => [
                  <tr key={dossier.key} className="mission-task-list__dossier-row">
                    <th colSpan={6} scope="rowgroup">
                      <span className="mission-task-list__dossier-title">{dossier.reference}</span>
                      <span>{dossier.client}</span>
                      <span>{dossier.site}</span>
                      <strong>{dossier.count} tâche{dossier.count > 1 ? 's' : ''}</strong>
                    </th>
                  </tr>,
                  ...dossier.jalons.flatMap((jalon) => [
                    <tr key={`${dossier.key}-${jalon.key}`} className="mission-task-list__jalon-row">
                      <th colSpan={6} scope="rowgroup">{jalon.label} <span>· {jalon.tasks.length} tâche{jalon.tasks.length > 1 ? 's' : ''}</span></th>
                    </tr>,
                    ...jalon.tasks.map((task) => {
                  const om = task.ordreMissionLigne?.ordreMission
                  const statut = getTaskStatutMeta(task.statut)
                  const plannedDate = taskReferenceDate(task)
                  return (
                    <tr
                      key={task.id}
                      className="mission-task-list__row"
                      tabIndex={0}
                      role="button"
                      aria-label={`Modifier ${task.unique_number ?? `la tâche ${task.id}`}`}
                      onClick={() => setSelectedTask(task)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedTask(task)
                        }
                      }}
                    >
                      <td>
                        <strong>{task.unique_number ?? `TSK-${task.id}`}</strong>
                        {om ? <div className="text-muted mission-task-list__sub">{om.numero}</div> : null}
                      </td>
                      <td>
                        <div className="mission-task-list__task">{taskLabel(task)}</div>
                      </td>
                      <td>{task.assignedUser?.name ?? <span className="text-muted">Non assigné</span>}</td>
                      <td>
                        <span className="mission-task-list__status" style={{ color: statut.color, background: statut.bg }}>
                          {statut.label}
                        </span>
                      </td>
                      <td>{plannedDate ? formatAppDate(plannedDate) : <span className="text-muted">—</span>}</td>
                      <td><DelayCell task={task} /></td>
                    </tr>
                  )
                    }),
                  ]),
                ])}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-muted mission-task-list__hint">
        Cliquez sur une ligne pour modifier la tâche, saisir les PV et préparer les étiquettes de réception.
      </p>
      {selectedTask ? <TaskEditModal key={selectedTask.id} task={selectedTask} context={context} onClose={closeTaskModal} /> : null}
    </ModuleEntityShell>
  )
}
