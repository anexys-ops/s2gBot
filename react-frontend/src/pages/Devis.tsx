import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { quotesApi, clientsApi, sitesApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import type { QuoteCreateBody } from '../api/client'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
}

export default function Devis() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<QuoteCreateBody>({
    client_id: 0,
    quote_date: new Date().toISOString().slice(0, 10),
    valid_until: '',
    tva_rate: 20,
    notes: '',
    lines: [{ description: '', quantity: 1, unit_price: 0 }],
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => quotesApi.list(),
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
  })

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
    enabled: isLab && form.client_id > 0,
  })

  const createMutation = useMutation({
    mutationFn: (body: QuoteCreateBody) => quotesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setShowForm(false)
      setForm({
        client_id: 0,
        quote_date: new Date().toISOString().slice(0, 10),
        valid_until: '',
        tva_rate: 20,
        notes: '',
        lines: [{ description: '', quantity: 1, unit_price: 0 }],
      })
    },
  })

  const clients = Array.isArray(clientsData) ? clientsData : []
  const sites = Array.isArray(sitesData) ? sitesData : []
  const quotes = data?.data ?? []

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { description: '', quantity: 1, unit_price: 0 }],
    }))
  }

  const updateLine = (index: number, field: string, value: string | number) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) =>
        i === index ? { ...l, [field]: value } : l
      ),
    }))
  }

  const removeLine = (index: number) => {
    if (form.lines.length <= 1) return
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.client_id <= 0 || form.lines.some((l) => !l.description || l.quantity <= 0)) {
      return
    }
    createMutation.mutate({
      ...form,
      valid_until: form.valid_until || undefined,
      site_id: form.site_id || undefined,
    })
  }

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur : {String(error)}</p>

  return (
    <div>
      <h1>Devis</h1>
      {isLab && (
        <>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginBottom: '1rem' }}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Annuler' : 'Nouveau devis'}
          </button>
          {showForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3>Créer un devis</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <label>
                    Client *
                    <select
                      value={form.client_id}
                      onChange={(e) => setForm((f) => ({ ...f, client_id: Number(e.target.value) }))}
                      required
                    >
                      <option value={0}>Choisir...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Chantier
                    <select
                      value={form.site_id ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, site_id: e.target.value ? Number(e.target.value) : undefined }))
                      }
                    >
                      <option value="">—</option>
                      {sites.filter((s) => s.client_id === form.client_id).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Date *
                    <input
                      type="date"
                      value={form.quote_date}
                      onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Valide jusqu'au
                    <input
                      type="date"
                      value={form.valid_until ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                    />
                  </label>
                  <label>
                    TVA (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={form.tva_rate ?? 20}
                      onChange={(e) => setForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea
                    value={form.notes ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                  />
                </label>
                <h4 style={{ marginTop: '1rem' }}>Lignes</h4>
                {form.lines.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 80px 100px 80px auto',
                      gap: '0.5rem',
                      alignItems: 'end',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <input
                      placeholder="Désignation"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, 'unit_price', Number(e.target.value))}
                    />
                    <span>{((line.quantity || 0) * (line.unit_price || 0)).toFixed(2)} €</span>
                    <button type="button" className="btn btn-secondary" onClick={() => removeLine(index)}>
                      Suppr.
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary" onClick={addLine} style={{ marginBottom: '1rem' }}>
                  + Ligne
                </button>
                <div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createMutation.isPending || form.client_id <= 0}
                  >
                    {createMutation.isPending ? 'Création...' : 'Créer le devis'}
                  </button>
                  {createMutation.isError && (
                    <span className="error"> {(createMutation.error as Error).message}</span>
                  )}
                </div>
              </form>
            </div>
          )}
        </>
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
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>{q.number}</td>
                <td>{q.client?.name}</td>
                <td>{new Date(q.quote_date).toLocaleDateString('fr-FR')}</td>
                <td>{Number(q.amount_ttc).toFixed(2)}</td>
                <td>{STATUS_LABELS[q.status] ?? q.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {quotes.length === 0 && <p style={{ padding: '1rem' }}>Aucun devis.</p>}
      </div>
    </div>
  )
}
