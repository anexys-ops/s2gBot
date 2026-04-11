import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  in_progress: 'En cours',
  completed: 'Terminée',
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

export default function Orders() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const { visible, toggle } = usePersistedColumnVisibility('orders', {
    reference: true,
    client: true,
    site: true,
    date: true,
    status: true,
    actions: true,
  })

  const deleteMut = useMutation({
    mutationFn: (orderId: number) => ordersApi.delete(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', debouncedSearch, statusFilter, page],
    queryFn: () =>
      ordersApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
      }),
  })

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur: {String(error)}</p>

  const orders = data?.data ?? []
  const lastPage = data?.last_page ?? 1

  return (
    <div>
      <h1>Commandes</h1>
      <Link to="/orders/new" className="btn btn-primary" style={{ marginBottom: '1rem' }}>
        Nouvelle commande
      </Link>
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        searchPlaceholder="Référence, notes…"
        statusValue={statusFilter}
        onStatusChange={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
        statusOptions={STATUS_OPTIONS}
        columns={[
          { id: 'reference', label: 'Référence' },
          { id: 'client', label: 'Client' },
          { id: 'site', label: 'Chantier' },
          { id: 'date', label: 'Date' },
          { id: 'status', label: 'Statut' },
          { id: 'actions', label: 'Actions' },
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              {visible.reference !== false && <th>Référence</th>}
              {visible.client !== false && <th>Client</th>}
              {visible.site !== false && <th>Chantier</th>}
              {visible.date !== false && <th>Date</th>}
              {visible.status !== false && <th>Statut</th>}
              {visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                {visible.reference !== false && <td>{o.reference}</td>}
                {visible.client !== false && <td>{o.client?.name}</td>}
                {visible.site !== false && <td>{o.site?.name ?? '-'}</td>}
                {visible.date !== false && <td>{new Date(o.order_date).toLocaleDateString('fr-FR')}</td>}
                {visible.status !== false && <td>{STATUS_LABELS[o.status] ?? o.status}</td>}
                {visible.actions !== false && (
                  <td>
                    <div className="crud-actions">
                      <Link to={`/orders/${o.id}`}>Détail</Link>
                      {(isAdmin ||
                        (o.status === 'draft' &&
                          (isLab || (user?.role === 'client' && o.client_id === user.client_id)))) && (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => {
                            if (window.confirm(`Supprimer la commande ${o.reference} ?`)) deleteMut.mutate(o.id)
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ padding: '1rem' }}>Aucune commande.</p>}
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>
    </div>
  )
}
