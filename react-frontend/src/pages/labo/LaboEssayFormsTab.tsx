import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { planningTerrainApi, taskTestFormsApi, type LaboTaskTestFormRow } from '../../api/client'
import Modal from '../../components/Modal'
import TestFormWebEditor from '../../components/tasks/TestFormWebEditor'
import TaskTestFormResults from '../../components/tasks/TaskTestFormResults'
import StatusBadge, { essayFormStatutBadgeProps } from '../../components/ds/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { formatAppDate } from '../../lib/appLocale'
import { formatTechnicienOption } from '../../lib/userRolePresentation'

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Non commencé',
  draft: 'Brouillon',
  submitted: 'Soumis',
  correction_requested: 'Correction demandée',
  validated: 'Validé',
}

type SortKey = 'fold' | 'updated_at' | 'statut' | 'technicien'

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'fold', label: 'N° FOLD' },
  { key: 'technicien', label: 'Technicien' },
  { key: 'statut', label: 'Statut' },
  { key: 'updated_at', label: 'Mis à jour' },
]

function EssayFormDetail({ row, onClose }: { row: LaboTaskTestFormRow; onClose: () => void }) {
  const { user } = useAuth()
  const taskId = row.task?.id
  const typeId = row.test_type?.id
  const [correctionNote, setCorrectionNote] = useState('')
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['task-test-forms', taskId],
    queryFn: () => taskTestFormsApi.list(taskId!),
    enabled: !!taskId,
  })

  const review = useMutation({
    mutationFn: ({ decision, note }: { decision: 'validate' | 'correction'; note?: string }) =>
      taskTestFormsApi.review(taskId!, typeId!, decision, note),
    onSuccess: () => void refetch(),
  })

  const form = data?.forms.find((f) => f.test_type.id === typeId)
  const editable = row.status === 'draft' || row.status === 'correction_requested' || row.status === 'not_started'
  const canReview = (user?.role === 'lab_admin' || user?.role === 'responsable') && row.status === 'submitted'

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
      <>
        <TaskTestFormResults forms={[form]} taskId={taskId} />
        {canReview ? <div className="crud-actions" style={{ marginTop: '0.75rem' }}>
          <input
            placeholder="Motif de correction"
            value={correctionNote}
            onChange={(e) => setCorrectionNote(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={review.isPending || !correctionNote.trim()}
            onClick={() => review.mutate({ decision: 'correction', note: correctionNote })}
          >
            Demander correction
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={review.isPending} onClick={() => review.mutate({ decision: 'validate' })}>
            Valider le formulaire
          </button>
        </div> : null}
        {review.isError ? <p className="error">{(review.error as Error).message}</p> : null}
      </>
    )}
  </Modal>
}

export default function LaboEssayFormsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const [technicienFilter, setTechnicienFilter] = useState('')
  const [sort, setSort] = useState<SortKey>('fold')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<LaboTaskTestFormRow | null>(null)
  const queryClient = useQueryClient()

  const { data: techniciens = [] } = useQuery({
    queryKey: ['planning-techniciens', 'labo'],
    queryFn: () => planningTerrainApi.techniciens('labo'),
    staleTime: 5 * 60_000,
  })

  const { data: paginator, isLoading } = useQuery({
    queryKey: ['labo-task-test-forms', statusFilter, technicienFilter, sort, dir, page],
    queryFn: () => taskTestFormsApi.listAll({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(technicienFilter ? { user_id: Number(technicienFilter) } : {}),
      sort,
      dir,
      page,
    }),
    staleTime: 15_000,
  })

  const rows = paginator?.data ?? []
  const stats = paginator?.stats

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      setDir('asc')
    }
    setPage(1)
  }

  return <div>
    {stats ? <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 120 }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.today_total}</div>
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>Essais prévus aujourd’hui</div>
      </div>
      <div style={{ minWidth: 120, borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2b6cb0' }}>{stats.today_started}</div>
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>Commencés aujourd’hui</div>
      </div>
      <div style={{ minWidth: 120, borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: stats.late > 0 ? '#c53030' : '#2f855a' }}>{stats.late}</div>
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>En retard</div>
      </div>
      <div style={{ minWidth: 120, borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.total}</div>
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>Total formulaires</div>
      </div>
    </div> : null}

    <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
        Statut
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">— Tous statuts —</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
        Technicien
        <select value={technicienFilter} onChange={(e) => { setTechnicienFilter(e.target.value); setPage(1) }}>
          <option value="">— Tous techniciens —</option>
          {techniciens.map((t) => <option key={t.id} value={t.id}>{formatTechnicienOption(t)}</option>)}
        </select>
      </label>
      <span className="text-muted">{paginator?.total ?? 0} formulaire{(paginator?.total ?? 0) > 1 ? 's' : ''}</span>
    </div>

    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
      <span className="text-muted" style={{ fontSize: '0.8rem' }}>Trier par :</span>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`btn btn-sm ${sort === opt.key ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => toggleSort(opt.key)}
        >
          {opt.label}{sort === opt.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
      ))}
    </div>

    {isLoading ? <p className="text-muted">Chargement…</p> : null}
    {!isLoading && rows.length === 0 ? <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><p className="text-muted">Aucun formulaire d’essai.</p></div> : null}

    {rows.length > 0 ? <div className="card" style={{ overflow: 'auto' }}>
      <table className="data-table data-table--compact">
        <thead><tr>
          <th>Essai</th><th>Tâche</th><th>N° FOLD</th><th>N° PV</th><th>Technicien</th><th>Statut</th><th>Mis à jour</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const badge = essayFormStatutBadgeProps(row.status)
            return <tr
              key={row.id}
              tabIndex={0}
              role="button"
              className={row.is_late ? 'labo-essay-row--late' : undefined}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(row)}
            >
              <td>{row.test_type?.name ?? '—'}</td>
              <td>{row.task?.unique_number ?? '—'}</td>
              <td>{row.fold_numbers?.length ? row.fold_numbers.join(', ') : '—'}</td>
              <td>{row.pv_numbers?.length ? row.pv_numbers.join(', ') : '—'}</td>
              <td>{row.task?.assigned_user ?? '—'}</td>
              <td>
                <StatusBadge variant={badge.variant} size="sm">{badge.label}</StatusBadge>
                {row.is_late ? <span className="labo-essay-row__late-tag"> En retard</span> : null}
              </td>
              <td>{formatAppDate(row.updated_at)}</td>
            </tr>
          })}
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
