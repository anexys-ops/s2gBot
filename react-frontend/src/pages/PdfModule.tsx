import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { bonsCommandeApi, ordersApi, quotesApi, invoicesApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import DocumentPdfPickerModal from '../components/pdf/DocumentPdfPickerModal'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { PdfGenerateType } from '../lib/documentPdfTypes'
import { pdfGenerateTypeLabel } from '../lib/documentPdfTypes'

const LAB_TYPES: PdfGenerateType[] = ['quote', 'invoice', 'report', 'purchase_order', 'delivery_note']

export default function PdfModule() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [type, setType] = useState<PdfGenerateType>('quote')
  const [resourceId, setResourceId] = useState<string>('')
  const [docSearch, setDocSearch] = useState('')
  const debouncedDocSearch = useDebouncedValue(docSearch, 200)
  const [pickerOpen, setPickerOpen] = useState(false)

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

  const { data: bcsData } = useQuery({
    queryKey: ['bons-commande'],
    queryFn: () => bonsCommandeApi.list(),
    enabled: isLab && type === 'purchase_order',
  })

  const quotes = quotesData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const orders = ordersData?.data ?? []
  const bcs = bcsData ?? []

  const options = useMemo(() => {
    if (type === 'quote') return quotes.map((q) => ({ id: q.id, label: `${q.number} — ${q.client?.name ?? ''}` }))
    if (type === 'invoice') return invoices.map((i) => ({ id: i.id, label: `${i.number} — ${i.client?.name ?? ''}` }))
    if (type === 'report') return orders.map((o) => ({ id: o.id, label: `${o.reference} — ${o.client?.name ?? ''}` }))
    if (type === 'purchase_order') return bcs.map((bc) => ({ id: bc.id, label: `${bc.numero} — ${bc.client?.name ?? ''}` }))
    return []
  }, [type, quotes, invoices, orders, bcs])

  const filteredOptions = useMemo(() => {
    const q = debouncedDocSearch.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, debouncedDocSearch])

  const selectedLabel = useMemo(() => {
    const id = Number(resourceId)
    return options.find((o) => o.id === id)?.label ?? resourceId
  }, [options, resourceId])

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
              setType(e.target.value as PdfGenerateType)
              setResourceId('')
              setDocSearch('')
            }}
          >
            {LAB_TYPES.map((t) => (
              <option key={t} value={t}>
                {pdfGenerateTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        {(type === 'quote' || type === 'invoice' || type === 'report' || type === 'purchase_order') && (
          <>
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
          </>
        )}
        {type === 'delivery_note' && (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Ouvrez la fiche BL depuis le module Commercial pour générer le PDF avec choix du modèle.
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!resourceId || type === 'delivery_note'}
          onClick={() => setPickerOpen(true)}
        >
          Choisir le modèle et visualiser
        </button>
      </div>

      {pickerOpen && resourceId ? (
        <DocumentPdfPickerModal
          documentType={type}
          documentId={Number(resourceId)}
          documentLabel={selectedLabel}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  )
}
