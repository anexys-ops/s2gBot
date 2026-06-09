import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { equipmentsApi, type EquipmentRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import EquipmentCreateModal from '../../components/materiel/EquipmentCreateModal'
import { MATERIEL_MODULE_TABS } from '../materiel/materielModuleTabs'

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
  const [status, setStatus] = useState('')
  const [dueWithin, setDueWithin] = useState<number | ''>('')
  const [createOpen, setCreateOpen] = useState(false)

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

  if (!isLab) {
    return <Navigate to="/" replace />
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Matériel', to: '/materiel' },
        { label: 'Parc équipements' },
      ]}
      moduleBarLabel="Matériel"
      title="Parc équipements"
      subtitle="Liste du matériel, étalonnages et fiches détaillées."
      tabs={MATERIEL_MODULE_TABS}
      actions={
        isAdmin ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            Nouvel équipement
          </button>
        ) : undefined
      }
    >
      <div className="card list-table-toolbar materiel-equipments-toolbar">
        <div className="list-table-toolbar__row">
          <label className="list-table-toolbar__field list-table-toolbar__status">
            <span className="filter-label">Statut</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="list-table-toolbar__field materiel-equipments-toolbar__due">
            <span className="filter-label">Échéance dans (j.)</span>
            <input
              type="number"
              className="article-actions-form__input article-actions-form__input--number"
              min={1}
              max={365}
              value={dueWithin}
              onChange={(e) => {
                const v = e.target.value
                setDueWithin(v === '' ? '' : Math.min(365, Math.max(1, Number(v))))
              }}
              placeholder="ex. 30"
            />
          </label>
        </div>
      </div>

      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {!isLoading && !error && (
        <div className="card dossier-tab-panel dossier-tab-panel--table">
          {rows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table data-table--compact">
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
                        <Link to={`/materiel/equipements/${eq.id}`} className="link-inline">
                          <code className="code-badge">{eq.code}</code>
                        </Link>
                      </td>
                      <td>{eq.name}</td>
                      <td>{eq.status}</td>
                      <td>{eq.agency?.name ?? '—'}</td>
                      <td>{nextDueLabel(eq)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dossier-tab-empty">Aucun équipement pour ces filtres.</p>
          )}
        </div>
      )}

      {createOpen ? <EquipmentCreateModal onClose={() => setCreateOpen(false)} /> : null}
    </ModuleEntityShell>
  )
}
