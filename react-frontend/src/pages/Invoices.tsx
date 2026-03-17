import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi, ordersApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
}

export default function Invoices() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const queryClient = useQueryClient()
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([])

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
    enabled: isLab,
  })

  const fromOrdersMutation = useMutation({
    mutationFn: (orderIds: number[]) => invoicesApi.fromOrders(orderIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setSelectedOrderIds([])
    },
  })

  const orders = ordersData?.data ?? []
  const invoices = data?.data ?? []

  const toggleOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur: {String(error)}</p>

  return (
    <div>
      <h1>Factures</h1>
      {isLab && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>Créer une facture à partir de commandes</h3>
          <p>Sélectionnez une ou plusieurs commandes (même client) :</p>
          <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
            {orders
              .filter((o) => o.status === 'completed' || o.status === 'in_progress')
              .map((o) => (
                <label key={o.id} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(o.id)}
                    onChange={() => toggleOrder(o.id)}
                  />{' '}
                  {o.reference} — {o.client?.name}
                </label>
              ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedOrderIds.length === 0 || fromOrdersMutation.isPending}
            onClick={() => fromOrdersMutation.mutate(selectedOrderIds)}
          >
            {fromOrdersMutation.isPending ? 'Création...' : 'Créer la facture'}
          </button>
          {fromOrdersMutation.isError && (
            <span className="error"> {(fromOrdersMutation.error as Error).message}</span>
          )}
        </div>
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Client</th>
              <th>Date</th>
              <th>Montant TTC (€)</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.number}</td>
                <td>{inv.client?.name}</td>
                <td>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</td>
                <td>{Number(inv.amount_ttc).toFixed(2)}</td>
                <td>{STATUS_LABELS[inv.status] ?? inv.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <p style={{ padding: '1rem' }}>Aucune facture.</p>}
      </div>
    </div>
  )
}
