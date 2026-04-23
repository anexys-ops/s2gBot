import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge, { equipementStatutBadgeProps } from '../../components/ds/StatusBadge'

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const equipmentId = Number(id)
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()

  const [calForm, setCalForm] = useState({
    calibration_date: new Date().toISOString().slice(0, 10),
    next_due_date: '',
    provider: '',
    result: 'ok',
    notes: '',
  })

  const { data: eq, isLoading, error } = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: () => equipmentsApi.get(equipmentId),
    enabled: isLab && Number.isFinite(equipmentId),
  })

  const addCal = useMutation({
    mutationFn: () =>
      equipmentsApi.createCalibration(equipmentId, {
        calibration_date: calForm.calibration_date,
        next_due_date: calForm.next_due_date || null,
        provider: calForm.provider || null,
        result: calForm.result,
        notes: calForm.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] })
      queryClient.invalidateQueries({ queryKey: ['equipments'] })
      setCalForm((f) => ({
        ...f,
        next_due_date: '',
        provider: '',
        notes: '',
      }))
    },
  })

  if (!isLab) {
    return <Navigate to="/" replace />
  }
  if (!Number.isFinite(equipmentId)) {
    return <Navigate to="/materiel/equipements" replace />
  }

  const eqSt = eq ? equipementStatutBadgeProps(eq.status) : null

  return (
    <div className="container">
      <p>
        <Link to="/materiel/equipements">← Liste équipements</Link>
      </p>
      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {eq && (
        <>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card__header" style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                {eq.code} — {eq.name}
              </h2>
            </div>
            <dl className="meta-dl" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, margin: 0 }}>
            <dt className="text-muted" style={{ fontSize: '0.85rem' }}>Statut</dt>
            <dd style={{ margin: 0 }}>
              {eqSt && (
                <StatusBadge variant={eqSt.variant} size="md">
                  {eqSt.label}
                </StatusBadge>
              )}
            </dd>
            <dt className="text-muted" style={{ fontSize: '0.85rem' }}>Marque / modèle</dt>
            <dd>
              {[eq.brand, eq.model].filter(Boolean).join(' · ') || '—'}
            </dd>
            <dt className="text-muted" style={{ fontSize: '0.85rem' }}>N° série</dt>
            <dd>{eq.serial_number ?? '—'}</dd>
            <dt className="text-muted" style={{ fontSize: '0.85rem' }}>Emplacement</dt>
            <dd>{eq.location ?? '—'}</dd>
            <dt className="text-muted" style={{ fontSize: '0.85rem' }}>Agence</dt>
            <dd>{eq.agency?.name ?? '—'}</dd>
            <dt className="text-muted" style={{ fontSize: '0.85rem' }}>Types d’essai</dt>
            <dd>{eq.test_types?.map((t) => t.name).join(', ') || '—'}</dd>
            </dl>
          </div>

          <div className="card">
            <div className="card__header">
              <h3>Étalonnages</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table data-table--compact" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Prochaine échéance</th>
                    <th>Fournisseur</th>
                    <th>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {(eq.calibrations ?? []).map((c) => (
                    <tr key={c.id}>
                      <td>{c.calibration_date ? new Date(c.calibration_date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{c.next_due_date ? new Date(c.next_due_date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{c.provider ?? '—'}</td>
                      <td>{c.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(eq.calibrations ?? []).length === 0 && (
              <p className="text-muted" style={{ padding: '0.5rem 0 0' }}>Aucun étalonnage enregistré.</p>
            )}
          </div>

          {isAdmin && (
            <form
              className="card"
              style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
              onSubmit={(e) => {
                e.preventDefault()
                addCal.mutate()
              }}
            >
              <h3 className="ds-form-section__title" style={{ margin: '0 0 0.5rem' }}>
                Ajouter un étalonnage
              </h3>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Date d’étalonnage</label>
                <input
                  type="date"
                  value={calForm.calibration_date}
                  onChange={(e) => setCalForm((f) => ({ ...f, calibration_date: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Prochaine échéance</label>
                <input
                  type="date"
                  value={calForm.next_due_date}
                  onChange={(e) => setCalForm((f) => ({ ...f, next_due_date: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Fournisseur</label>
                <input
                  value={calForm.provider}
                  onChange={(e) => setCalForm((f) => ({ ...f, provider: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Résultat</label>
                <select
                  value={calForm.result}
                  onChange={(e) =>
                    setCalForm((f) => ({
                      ...f,
                      result: e.target.value as 'ok' | 'ok_with_reserve' | 'failed',
                    }))
                  }
                >
                  <option value="ok">ok</option>
                  <option value="ok_with_reserve">ok_with_reserve</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Notes</label>
                <textarea rows={2} value={calForm.notes} onChange={(e) => setCalForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              {addCal.isError && <p className="error">{(addCal.error as Error).message}</p>}
              <button type="submit" className="btn btn-primary" disabled={addCal.isPending}>
                Enregistrer
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
