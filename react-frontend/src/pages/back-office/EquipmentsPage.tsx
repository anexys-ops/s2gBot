import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi, testTypesApi, type EquipmentRow, type TestType } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tous statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retiré' },
]

function nextDueLabel(eq: EquipmentRow): string {
  const cals = eq.calibrations ?? []
  const withDue = cals.map((c) => c.next_due_date).filter(Boolean) as string[]
  if (withDue.length === 0) return '—'
  const sorted = [...withDue].sort()
  return sorted[0] ? new Date(sorted[0]).toLocaleDateString('fr-FR') : '—'
}

export default function EquipmentsPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [dueWithin, setDueWithin] = useState<number | ''>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', test_type_ids: [] as number[] })

  const listParams = useMemo(() => {
    const p: { status?: string; due_within?: number } = {}
    if (status) p.status = status
    if (dueWithin !== '' && dueWithin > 0) p.due_within = dueWithin
    return p
  }, [status, dueWithin])

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['equipments', listParams],
    queryFn: () => equipmentsApi.list(listParams),
    enabled: isLab,
  })

  const { data: testTypes = [] } = useQuery({
    queryKey: ['test-types'],
    queryFn: () => testTypesApi.list(),
    enabled: isLab && createOpen,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      equipmentsApi.create({
        name: form.name.trim(),
        code: form.code.trim(),
        test_type_ids: form.test_type_ids,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipments'] })
      setCreateOpen(false)
      setForm({ name: '', code: '', test_type_ids: [] })
    },
  })

  if (!isLab) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="design-card">
      <div className="design-card__toolbar" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <label className="design-card__muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="design-card__muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Échéance dans (j.)
          <input
            type="number"
            min={1}
            max={365}
            className="input"
            style={{ width: 90 }}
            value={dueWithin}
            onChange={(e) => {
              const v = e.target.value
              setDueWithin(v === '' ? '' : Math.min(365, Math.max(1, Number(v))))
            }}
            placeholder="ex. 30"
          />
        </label>
        {isAdmin && (
          <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            Nouvel équipement
          </button>
        )}
      </div>

      {isLoading && <p className="design-card__muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {!isLoading && !error && (
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Statut</th>
                <th>Agence</th>
                <th>Prochain étalonnage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((eq) => (
                <tr key={eq.id}>
                  <td>
                    <Link to={`/back-office/equipements/${eq.id}`}>{eq.code}</Link>
                  </td>
                  <td>{eq.name}</td>
                  <td>{eq.status}</td>
                  <td>{eq.agency?.name ?? '—'}</td>
                  <td>{nextDueLabel(eq)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="design-card__muted">Aucun équipement pour ces filtres.</p>}
        </div>
      )}

      {createOpen && (
        <Modal title="Nouvel équipement" onClose={() => setCreateOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.name.trim() || !form.code.trim()) return
              createMutation.mutate()
            }}
            className="stack"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label>
              <span className="design-card__muted">Nom</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label>
              <span className="design-card__muted">Code unique</span>
              <input
                className="input"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                required
              />
            </label>
            <fieldset>
              <legend className="design-card__muted">Types d’essai liés</legend>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                {testTypes.map((t: TestType) => (
                  <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.test_type_ids.includes(t.id)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          test_type_ids: e.target.checked
                            ? [...f.test_type_ids, t.id]
                            : f.test_type_ids.filter((id) => id !== t.id),
                        }))
                      }}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {createMutation.isError && <p className="error">{(createMutation.error as Error).message}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
                Créer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
