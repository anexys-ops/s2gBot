import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { taskTestFormsApi, type LaboTaskTestFormRow } from '../../api/client'
import Modal from '../../components/Modal'
import TestFormWebEditor from '../../components/tasks/TestFormWebEditor'
import TaskTestFormResults from '../../components/tasks/TaskTestFormResults'
import { formatAppDate } from '../../lib/appLocale'

const STATUS_LABELS: Record<string, string> = {
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
  const editable = row.status === 'draft' || row.status === 'correction_requested'

  return <Modal title={row.test_type?.name ?? 'Essai'} onClose={onClose} size="wide">
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
  const [selected, setSelected] = useState<LaboTaskTestFormRow | null>(null)
  const queryClient = useQueryClient()

  const { data: paginator, isLoading } = useQuery({
    queryKey: ['labo-task-test-forms', statusFilter],
    queryFn: () => taskTestFormsApi.listAll(statusFilter ? { status: statusFilter } : undefined),
    staleTime: 15_000,
  })

  const rows = paginator?.data ?? []

  return <div>
    <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
        Statut
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">— Tous statuts —</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <span className="text-muted">{rows.length} formulaire{rows.length > 1 ? 's' : ''}</span>
    </div>

    {isLoading ? <p className="text-muted">Chargement…</p> : null}
    {!isLoading && rows.length === 0 ? <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><p className="text-muted">Aucun formulaire d’essai.</p></div> : null}

    {rows.length > 0 ? <div className="card" style={{ overflow: 'auto' }}>
      <table className="data-table data-table--compact">
        <thead><tr>
          <th>Essai</th><th>Tâche</th><th>Client</th><th>Chantier</th><th>Dossier</th><th>Technicien</th><th>Statut</th><th>Mis à jour</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id} tabIndex={0} role="button" style={{ cursor: 'pointer' }} onClick={() => setSelected(row)}>
            <td>{row.test_type?.name ?? '—'}</td>
            <td>{row.task?.unique_number ?? '—'}</td>
            <td>{row.client ?? '—'}</td>
            <td>{row.chantier ?? '—'}</td>
            <td>{row.dossier ?? '—'}</td>
            <td>{row.task?.assigned_user ?? '—'}</td>
            <td>{STATUS_LABELS[row.status] ?? row.status}</td>
            <td>{formatAppDate(row.updated_at)}</td>
          </tr>)}
        </tbody>
      </table>
    </div> : null}

    {selected ? <EssayFormDetail row={selected} onClose={() => { setSelected(null); void queryClient.invalidateQueries({ queryKey: ['labo-task-test-forms'] }) }} /> : null}
  </div>
}
