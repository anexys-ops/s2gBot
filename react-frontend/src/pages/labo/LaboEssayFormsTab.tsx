import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { taskTestFormsApi, type LaboTaskTestFormRow } from '../../api/client'
import Modal from '../../components/Modal'
import TestFormWebEditor from '../../components/tasks/TestFormWebEditor'
import TaskTestFormResults from '../../components/tasks/TaskTestFormResults'
import { formatAppDate } from '../../lib/appLocale'

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Non commencé',
  draft: 'Brouillon',
  submitted: 'Soumis',
  correction_requested: 'Correction demandée',
  validated: 'Validé',
}

function EssayFormDetail({ row, onClose }: { row: LaboTaskTestFormRow; onClose: () => void }) {
  const taskId = row.task?.id
  const typeId = row.test_type?.id
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['task-test-forms', taskId],
    queryFn: () => taskTestFormsApi.list(taskId!),
    enabled: !!taskId,
  })

  const form = data?.forms.find((f) => f.test_type.id === typeId)
  const editable = row.status === 'draft' || row.status === 'correction_requested' || row.status === 'not_started'

  return <Modal title={row.test_type?.name ?? 'Essai'} onClose={onClose} size="xl">
    {isLoading ? <p className="text-muted">Chargement…</p> : !form ? (
      <p className="error">Ce formulaire n’est plus disponible pour cette tâche (produit non affecté à cet essai, ou tâche introuvable).</p>
    ) : editable ? (
      <TestFormWebEditor
        taskId={taskId!}
        typeId={typeId!}
        fields={form.form_fields}
        initialAnswers={form.submission?.answers ?? {}}
        photos={form.submission?.photos ?? []}
        editable
        onChanged={() => void refetch()}
      />
    ) : (
      <TaskTestFormResults forms={[form]} taskId={taskId} />
    )}
  </Modal>
}

export default function LaboEssayFormsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<LaboTaskTestFormRow | null>(null)
  const queryClient = useQueryClient()

  const { data: paginator, isLoading } = useQuery({
    queryKey: ['labo-task-test-forms', statusFilter, page],
    queryFn: () => taskTestFormsApi.listAll({ ...(statusFilter ? { status: statusFilter } : {}), page }),
    staleTime: 15_000,
  })

  const rows = paginator?.data ?? []

  return <div>
    <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
        Statut
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">— Tous statuts —</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <span className="text-muted">{paginator?.total ?? 0} formulaire{(paginator?.total ?? 0) > 1 ? 's' : ''}</span>
    </div>

    {isLoading ? <p className="text-muted">Chargement…</p> : null}
    {!isLoading && rows.length === 0 ? <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><p className="text-muted">Aucun formulaire d’essai.</p></div> : null}

    {rows.length > 0 ? <div className="card" style={{ overflow: 'auto' }}>
      <table className="data-table data-table--compact">
        <thead><tr>
          <th>Essai</th><th>Tâche</th><th>N° FOLD</th><th>N° PV</th><th>Technicien</th><th>Statut</th><th>Mis à jour</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id} tabIndex={0} role="button" style={{ cursor: 'pointer' }} onClick={() => setSelected(row)}>
            <td>{row.test_type?.name ?? '—'}</td>
            <td>{row.task?.unique_number ?? '—'}</td>
            <td>{row.fold_numbers?.length ? row.fold_numbers.join(', ') : '—'}</td>
            <td>{row.pv_numbers?.length ? row.pv_numbers.join(', ') : '—'}</td>
            <td>{row.task?.assigned_user ?? '—'}</td>
            <td>{STATUS_LABELS[row.status] ?? row.status}</td>
            <td>{formatAppDate(row.updated_at)}</td>
          </tr>)}
        </tbody>
      </table>
    </div> : null}

    {paginator && paginator.last_page > 1 ? <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Précédent</button>
      <span className="text-muted">Page {paginator.current_page} / {paginator.last_page}</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page >= paginator.last_page} onClick={() => setPage((p) => p + 1)}>Suivant →</button>
    </div> : null}

    {selected ? <EssayFormDetail row={selected} onClose={() => { setSelected(null); void queryClient.invalidateQueries({ queryKey: ['labo-task-test-forms'] }) }} /> : null}
  </div>
}
