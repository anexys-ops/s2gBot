import { useQuery } from '@tanstack/react-query'
import { testTypesApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

export default function Catalog() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const [showForm, setShowForm] = useState(false)

  const { data: types, isLoading, error } = useQuery({
    queryKey: ['test-types'],
    queryFn: () => testTypesApi.list(),
  })

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur: {String(error)}</p>

  return (
    <div>
      <h1>Catalogue des essais</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Norme</th>
              <th>Unité</th>
              <th>Tarif unitaire (€)</th>
              <th>Paramètres</th>
            </tr>
          </thead>
          <tbody>
            {types?.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.norm ?? '-'}</td>
                <td>{t.unit ?? '-'}</td>
                <td>{Number(t.unit_price).toFixed(2)}</td>
                <td>{t.params?.map((p) => p.name).join(', ') ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {types?.length === 0 && <p style={{ padding: '1rem' }}>Aucun type d'essai.</p>}
      </div>
    </div>
  )
}
