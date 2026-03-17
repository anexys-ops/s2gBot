import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi, reportsApi, samplesApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  in_progress: 'En cours',
  completed: 'Terminée',
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [selectedSample, setSelectedSample] = useState<number | null>(null)
  const [resultValues, setResultValues] = useState<Record<number, string>>({})

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(Number(id)),
    enabled: !!id && id !== 'new',
  })

  const reportMutation = useMutation({
    mutationFn: () => ordersApi.generateReport(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
    },
  })

  const resultMutation = useMutation({
    mutationFn: ({ sampleId, results }: { sampleId: number; results: Array<{ test_type_param_id: number; value: string }> }) =>
      samplesApi.results(sampleId, results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setSelectedSample(null)
      setResultValues({})
    },
  })

  if (id === 'new') {
    navigate('/orders/new')
    return null
  }

  if (isLoading || !id) return <p>Chargement...</p>
  if (error || !order) return <p className="error">Commande introuvable.</p>

  const handleSubmitResults = () => {
    if (!selectedSample) return
    const results = Object.entries(resultValues)
      .filter(([, v]) => v !== '')
      .map(([paramId, value]) => ({ test_type_param_id: Number(paramId), value }))
    if (results.length === 0) return
    resultMutation.mutate({ sampleId: selectedSample, results })
  }

  const sample = order.order_items?.flatMap((oi) => oi.samples ?? []).find((s) => s.id === selectedSample)
  const params = sample?.order_item?.test_type?.params ?? []

  return (
    <div>
      <p>
        <Link to="/orders">← Commandes</Link>
      </p>
      <h1>Commande {order.reference}</h1>
      <p>
        Client : {order.client?.name} — Chantier : {order.site?.name ?? '-'} — Statut : {STATUS_LABELS[order.status] ?? order.status}
      </p>
      <p>Date : {new Date(order.order_date).toLocaleDateString('fr-FR')}</p>

      {isLab && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending}
          >
            {reportMutation.isPending ? 'Génération...' : 'Générer rapport PDF'}
          </button>
        </div>
      )}

      <div className="card">
        <h2>Rapports</h2>
        {order.reports?.length ? (
          <ul>
            {order.reports.map((r) => (
              <li key={r.id}>
                {r.filename}{' '}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => reportsApi.download(r.id)}
                >
                  Télécharger
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucun rapport généré.</p>
        )}
      </div>

      <div className="card">
        <h2>Lignes et échantillons</h2>
        {order.order_items?.map((item) => (
          <div key={item.id} style={{ marginBottom: '1.5rem' }}>
            <h3>{item.test_type?.name} (×{item.quantity})</h3>
            <table>
              <thead>
                <tr>
                  <th>Échantillon</th>
                  <th>Statut</th>
                  {isLab && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {item.samples?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.reference}</td>
                    <td>{s.status}</td>
                    {isLab && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setSelectedSample(s.id)
                            const vals: Record<number, string> = {}
                            s.test_results?.forEach((tr) => {
                              if (tr.test_type_param_id) vals[tr.test_type_param_id] = tr.value
                            })
                            setResultValues(vals)
                          }}
                        >
                          Saisir résultats
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {selectedSample && params.length > 0 && (
        <div className="card">
          <h3>Saisie des résultats</h3>
          {params.map((p) => (
            <div key={p.id} className="form-group">
              <label>{p.name} {p.unit ? `(${p.unit})` : ''}</label>
              <input
                value={resultValues[p.id] ?? ''}
                onChange={(e) => setResultValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
            </div>
          ))}
          <button type="button" className="btn btn-primary" onClick={handleSubmitResults} disabled={resultMutation.isPending}>
            Enregistrer
          </button>
          <button type="button" className="btn btn-secondary" style={{ marginLeft: '0.5rem' }} onClick={() => setSelectedSample(null)}>
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}
