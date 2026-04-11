import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageBackNav from '../components/PageBackNav'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi, clientsApi, sitesApi, testTypesApi } from '../api/client'

interface OrderItemRow {
  test_type_id: number
  quantity: number
}

export default function OrderNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [clientId, setClientId] = useState<number | ''>('')
  const [siteId, setSiteId] = useState<number | ''>('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItemRow[]>(() =>
    Array.from({ length: 5 }, () => ({ test_type_id: 0, quantity: 1 })),
  )
  const [clients, setClients] = useState<Array<{ id: number; name: string }>>([])
  const [sites, setSites] = useState<Array<{ id: number; name: string; client_id: number }>>([])
  const [testTypes, setTestTypes] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {})
    testTypesApi.list().then((list) => setTestTypes(list)).catch(() => {})
  }, [])

  useEffect(() => {
    if (clientId) {
      sitesApi.list().then((list) => setSites(list.filter((s) => s.client_id === Number(clientId)))).catch(() => {})
      setSiteId('')
    } else {
      setSites([])
      setSiteId('')
    }
  }, [clientId])

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof ordersApi.create>[0]) => ordersApi.create(body),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/orders/${order.id}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return
    const validItems = items.filter((i) => i.test_type_id > 0 && i.quantity > 0)
    if (validItems.length === 0) return
    createMutation.mutate({
      client_id: Number(clientId),
      site_id: siteId ? Number(siteId) : undefined,
      order_date: orderDate,
      notes: notes || undefined,
      items: validItems,
    })
  }

  function addRow() {
    setItems((prev) => [...prev, { test_type_id: 0, quantity: 1 }])
  }

  function addRows(n: number) {
    setItems((prev) => [...prev, ...Array.from({ length: n }, () => ({ test_type_id: 0, quantity: 1 }))])
  }

  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: keyof OrderItemRow, value: number) {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  return (
    <div>
      <PageBackNav back={{ to: '/orders', label: 'Liste des commandes' }} />
      <h1>Nouvelle commande</h1>
      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label>Client *</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')} required>
            <option value="">-- Choisir --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Chantier</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">-- Optionnel --</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Date de commande *</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <h3>Lignes d&apos;essais</h3>
        <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '0.5rem' }}>
          Plusieurs lignes vides pour préparer un dossier ; seules les lignes avec un type d&apos;essai choisi sont enregistrées.
        </p>
        {items.map((row, index) => (
          <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <select
              value={row.test_type_id}
              onChange={(e) => updateRow(index, 'test_type_id', Number(e.target.value))}
            >
              <option value={0}>-- Type d'essai --</option>
              {testTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => updateRow(index, 'quantity', parseInt(e.target.value, 10) || 1)}
              style={{ width: 80 }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => removeRow(index)}>
              Retirer
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={addRow}>
            + 1 ligne
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => addRows(5)}>
            + 5 lignes
          </button>
        </div>
        {createMutation.isError && (
          <p className="error">{(createMutation.error as Error).message}</p>
        )}
        <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Création...' : 'Créer la commande'}
        </button>
      </form>
    </div>
  )
}
