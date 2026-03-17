import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pdfApi, quotesApi, invoicesApi, ordersApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function PdfModule() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [type, setType] = useState<string>('quote')
  const [resourceId, setResourceId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: templatesData } = useQuery({
    queryKey: ['pdf-templates'],
    queryFn: () => pdfApi.templates(),
    enabled: isLab,
  })

  const { data: quotesData } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => quotesApi.list(),
    enabled: isLab && type === 'quote',
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
    enabled: isLab && type === 'invoice',
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
    enabled: isLab && type === 'report',
  })

  const templates = templatesData?.data ?? []
  const quotes = quotesData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const orders = ordersData?.data ?? []

  const options =
    type === 'quote'
      ? quotes.map((q) => ({ id: q.id, label: `${q.number} - ${q.client?.name}` }))
      : type === 'invoice'
        ? invoices.map((i) => ({ id: i.id, label: `${i.number} - ${i.client?.name}` }))
        : orders.map((o) => ({ id: o.id, label: `${o.reference} - ${o.client?.name}` }))

  const handleGenerate = async () => {
    const id = Number(resourceId)
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      await pdfApi.generate(type, id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!isLab) {
    return (
      <div>
        <h1>Création PDF</h1>
        <p>Accès réservé au back office.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Création de PDF</h1>
      <p>Générez un document PDF (devis, facture ou rapport d&apos;essais).</p>
      <div className="card" style={{ maxWidth: 500 }}>
        <h3>Choisir le type et le document</h3>
        <label>
          Type de document
          <select value={type} onChange={(e) => { setType(e.target.value); setResourceId('') }}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Document
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!resourceId || loading}
          onClick={handleGenerate}
        >
          {loading ? 'Génération...' : 'Télécharger le PDF'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
