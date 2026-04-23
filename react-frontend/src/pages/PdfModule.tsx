import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pdfApi, quotesApi, invoicesApi, ordersApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export default function PdfModule() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [type, setType] = useState<string>('quote')
  const [resourceId, setResourceId] = useState<string>('')
  const [docSearch, setDocSearch] = useState('')
  const debouncedDocSearch = useDebouncedValue(docSearch, 200)
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

  const filteredOptions = useMemo(() => {
    const q = debouncedDocSearch.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, debouncedDocSearch])

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
        <p>Accès réservé au laboratoire.</p>
      </div>
    )
  }

  return (
    <div>
      <PageBackNav back={{ to: '/crm', label: 'Commercial' }} extras={[{ to: '/terrain', label: 'Terrain' }, { to: '/labo', label: 'Laboratoire' }]} />
      <div className="card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Choisir le type et le document</h3>
        <div className="form-group">
          <label>Type de document</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setResourceId('')
              setDocSearch('')
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Filtrer les documents (vue liste)</label>
          <input
            type="search"
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            placeholder="N°, client, référence…"
          />
        </div>
        <div className="form-group">
          <label>Document ({filteredOptions.length} proposition(s))</label>
          <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
            <option value="">— Choisir —</option>
            {filteredOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={!resourceId || loading} onClick={handleGenerate}>
          {loading ? 'Génération...' : 'Télécharger le PDF'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
