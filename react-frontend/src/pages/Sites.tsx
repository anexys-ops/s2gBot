import { useQuery } from '@tanstack/react-query'
import { sitesApi } from '../api/client'

export default function Sites() {
  const { data: sites, isLoading, error } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  })

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur: {String(error)}</p>

  return (
    <div>
      <h1>Chantiers / Sites</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Client</th>
              <th>Référence</th>
              <th>Adresse</th>
            </tr>
          </thead>
          <tbody>
            {sites?.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.client?.name}</td>
                <td>{s.reference ?? '-'}</td>
                <td>{s.address ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sites?.length && <p style={{ padding: '1rem' }}>Aucun chantier.</p>}
      </div>
    </div>
  )
}
