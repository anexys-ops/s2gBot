import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersApi } from '../api/client'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  in_progress: 'En cours',
  completed: 'Terminée',
}

export default function Orders() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
  })

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur: {String(error)}</p>

  const orders = data?.data ?? []

  return (
    <div>
      <h1>Commandes</h1>
      <Link to="/orders/new" className="btn btn-primary" style={{ marginBottom: '1rem' }}>
        Nouvelle commande
      </Link>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Client</th>
              <th>Chantier</th>
              <th>Date</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.reference}</td>
                <td>{o.client?.name}</td>
                <td>{o.site?.name ?? '-'}</td>
                <td>{new Date(o.order_date).toLocaleDateString('fr-FR')}</td>
                <td>{STATUS_LABELS[o.status] ?? o.status}</td>
                <td>
                  <Link to={`/orders/${o.id}`}>Voir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ padding: '1rem' }}>Aucune commande.</p>}
      </div>
    </div>
  )
}
