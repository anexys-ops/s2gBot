import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '../api/client'

export default function Clients() {
  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur: {String(error)}</p>

  return (
    <div>
      <h1>Clients</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>SIRET</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email ?? '-'}</td>
                <td>{c.phone ?? '-'}</td>
                <td>{c.siret ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!clients?.length && <p style={{ padding: '1rem' }}>Aucun client.</p>}
      </div>
    </div>
  )
}
