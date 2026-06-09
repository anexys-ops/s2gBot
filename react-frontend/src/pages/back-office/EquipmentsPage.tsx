import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi, type EquipmentRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge, { equipementStatutBadgeProps } from '../../components/ds/StatusBadge'
import ListTableToolbar from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import EquipmentCreateModal from '../../components/materiel/EquipmentCreateModal'
import EquipmentEditModal from '../../components/materiel/EquipmentEditModal'
import { MATERIEL_MODULE_TABS } from '../materiel/materielModuleTabs'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retiré' },
] as const

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function nextDueLabel(eq: EquipmentRow): string {
  const cals = eq.calibrations ?? []
  const withDue = cals.map((c) => c.next_due_date).filter(Boolean) as string[]
  if (withDue.length === 0) return '—'
  const sorted = [...withDue].sort()
  return sorted[0] ? new Date(sorted[0]).toLocaleDateString('fr-FR') : '—'
}

function matchesSearch(eq: EquipmentRow, term: string): boolean {
  if (!term) return true
  const haystack = [
    eq.code,
    eq.name,
    eq.status,
    eq.type,
    eq.brand,
    eq.model,
    eq.serial_number,
    eq.location,
    eq.agency?.name,
    ...(eq.test_types?.map((t) => t.name) ?? []),
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
  return haystack.some((v) => v.includes(term))
}

export default function EquipmentsPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EquipmentRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EquipmentRow | null>(null)

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['equipments', status],
    queryFn: () => equipmentsApi.list(status ? { status } : undefined),
    enabled: isLab,
  })

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((eq) => matchesSearch(eq, term))
  }, [rows, search])

  const deleteMut = useMutation({
    mutationFn: (id: number) => equipmentsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipments'] })
      setDeleteTarget(null)
    },
  })

  const hasActiveFilters = search.trim() !== '' || status !== ''

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
      subtitle={
        <>
          {filteredRows.length} équipement{filteredRows.length !== 1 ? 's' : ''}
          {hasActiveFilters && rows.length !== filteredRows.length ? (
            <span className="text-muted"> (sur {rows.length} chargé{rows.length !== 1 ? 's' : ''})</span>
          ) : null}
        </>
      }
      tabs={MATERIEL_MODULE_TABS}
      actions={
        isAdmin ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            Nouvel équipement
          </button>
        ) : undefined
      }
    >
      <ListTableToolbar
        className="materiel-equipments-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Code, nom, agence, type, n° série…"
        statusValue={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        footer={
          hasActiveFilters ? (
            <>
              <span className="list-table-toolbar__footer-label">Filtres actifs</span>
              {search.trim() !== '' ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">Recherche : « {search.trim()} »</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setSearch('')}
                    aria-label="Effacer la recherche"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {status ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">{statusLabel(status)}</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setStatus('')}
                    aria-label="Effacer le filtre statut"
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </>
          ) : null
        }
      />

      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {!isLoading && !error && (
        <div className="card dossier-tab-panel dossier-tab-panel--table">
          {filteredRows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>Agence</th>
                    <th>Prochain étalonnage</th>
                    <th className="materiel-equipments-table__actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((eq) => {
                    const st = equipementStatutBadgeProps(eq.status)
                    return (
                      <tr key={eq.id}>
                        <td>
                          <Link to={`/materiel/equipements/${eq.id}`} className="link-inline">
                            <code className="code-badge">{eq.code}</code>
                          </Link>
                        </td>
                        <td>{eq.name}</td>
                        <td>
                          <StatusBadge variant={st.variant} size="sm">
                            {statusLabel(eq.status)}
                          </StatusBadge>
                        </td>
                        <td>{eq.agency?.name ?? '—'}</td>
                        <td>{nextDueLabel(eq)}</td>
                        <td className="materiel-equipments-table__actions">
                          <Link
                            to={`/materiel/equipements/${eq.id}`}
                            className="btn btn-secondary btn-sm"
                          >
                            Fiche
                          </Link>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditTarget(eq)}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-danger-outline"
                                title="Supprimer"
                                onClick={() => setDeleteTarget(eq)}
                              >
                                Supprimer
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dossier-tab-empty">
              {rows.length === 0
                ? 'Aucun équipement enregistré.'
                : 'Aucun équipement ne correspond à la recherche ou aux filtres.'}
            </p>
          )}
        </div>
      )}

      {createOpen ? <EquipmentCreateModal onClose={() => setCreateOpen(false)} /> : null}

      {editTarget ? (
        <EquipmentEditModal equipment={editTarget} onClose={() => setEditTarget(null)} />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer l'équipement"
          message={
            <>
              Supprimer définitivement <strong>{deleteTarget.code}</strong> — {deleteTarget.name} ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setDeleteTarget(null)
          }}
        />
      ) : null}
    </ModuleEntityShell>
  )
}
