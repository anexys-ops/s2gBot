import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageBackNav from '../components/PageBackNav'
import Modal from '../components/Modal'
import EntityMetaCard from '../components/module/EntityMetaCard'
import QuoteFormFields, { type QuoteFormState, type QuoteLineDraft } from '../components/quotes/QuoteFormFields'
import {
  quotesApi,
  clientsApi,
  sitesApi,
  clientAddressesApi,
  documentPdfTemplatesApi,
  commercialOfferingsApi,
  type QuoteCreateBody,
  type EntityMetaPayload,
  type CommercialOffering,
} from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatMoney } from '../lib/appLocale'

const DEFAULT_LINE_COUNT = 12

function emptyLine(defaultTva: number): QuoteLineDraft {
  return {
    description: '',
    quantity: 1,
    unit_price: 0,
    tva_rate: defaultTva,
    discount_percent: 0,
  }
}

function emptyForm(): QuoteFormState {
  const tva = 20
  return {
    client_id: 0,
    quote_date: new Date().toISOString().slice(0, 10),
    order_date: '',
    site_delivery_date: '',
    valid_until: '',
    tva_rate: tva,
    discount_percent: 0,
    discount_amount: 0,
    shipping_amount_ht: 0,
    shipping_tva_rate: 20,
    travel_fee_ht: 0,
    travel_fee_tva_rate: 20,
    apply_site_travel: false,
    notes: '',
    lines: Array.from({ length: DEFAULT_LINE_COUNT }, () => emptyLine(tva)),
  }
}

function toApiBody(form: QuoteFormState): QuoteCreateBody {
  const lines = form.lines
    .filter((l) => l.description.trim().length > 0 && l.quantity > 0)
    .map((l) => ({
      commercial_offering_id: l.commercial_offering_id ?? undefined,
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price: l.unit_price,
      tva_rate: l.tva_rate,
      discount_percent: l.discount_percent ?? 0,
    }))
  return {
    client_id: form.client_id,
    site_id: form.site_id,
    quote_date: form.quote_date,
    order_date: form.order_date || undefined,
    site_delivery_date: form.site_delivery_date || undefined,
    valid_until: form.valid_until || undefined,
    tva_rate: form.tva_rate,
    discount_percent: form.discount_percent,
    discount_amount: form.discount_amount,
    shipping_amount_ht: form.shipping_amount_ht,
    shipping_tva_rate: form.shipping_tva_rate,
    travel_fee_ht: form.travel_fee_ht,
    travel_fee_tva_rate: form.travel_fee_tva_rate,
    apply_site_travel: form.apply_site_travel,
    billing_address_id: form.billing_address_id,
    delivery_address_id: form.delivery_address_id,
    pdf_template_id: form.pdf_template_id,
    notes: form.notes,
    lines,
  }
}

export default function QuoteEditorPage() {
  const { quoteId } = useParams<{ quoteId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const editingNumericId = quoteId && quoteId !== 'nouveau' ? Number(quoteId) : null
  const isCreate = editingNumericId === null || Number.isNaN(editingNumericId)

  const [form, setForm] = useState<QuoteFormState>(emptyForm)
  const [catalogLineIndex, setCatalogLineIndex] = useState<number | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const catalogDebounced = useDebouncedValue(catalogSearch, 250)

  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', editingNumericId],
    queryFn: () => quotesApi.get(editingNumericId!),
    enabled: !isCreate && editingNumericId !== null,
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

  const { data: addrForm } = useQuery({
    queryKey: ['client-addresses', form.client_id],
    queryFn: () => clientAddressesApi.list(form.client_id),
    enabled: isLab && form.client_id > 0,
  })

  const { data: tplQuote } = useQuery({
    queryKey: ['document-pdf-templates', 'quote'],
    queryFn: () => documentPdfTemplatesApi.list('quote'),
    enabled: isLab,
  })

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['commercial-offerings-picker', catalogDebounced],
    queryFn: () => commercialOfferingsApi.list({ search: catalogDebounced.trim() || undefined, active_only: true, per_page: 80 }),
    enabled: catalogLineIndex !== null,
  })

  useEffect(() => {
    const cid = searchParams.get('client_id')
    const sid = searchParams.get('site_id')
    if (isCreate && cid) {
      const n = Number(cid)
      if (!Number.isNaN(n)) setForm((f) => ({ ...f, client_id: n }))
    }
    if (isCreate && sid) {
      const n = Number(sid)
      if (!Number.isNaN(n)) setForm((f) => ({ ...f, site_id: n }))
    }
  }, [isCreate, searchParams])

  useEffect(() => {
    if (!quote || isCreate) return
    if (quote.status !== 'draft') {
      navigate('/devis', { replace: true })
      return
    }
    const ql = quote.quote_lines ?? []
    const defaultTva = Number(quote.tva_rate ?? 20)
    const lines: QuoteLineDraft[] =
      ql.length > 0
        ? ql.map((l) => ({
            commercial_offering_id: l.commercial_offering_id ?? undefined,
            description: l.description,
            quantity: l.quantity,
            unit_price: Number(l.unit_price),
            tva_rate: Number(l.tva_rate ?? quote.tva_rate ?? 20),
            discount_percent: Number(l.discount_percent ?? 0),
            purchase_ref_ht: l.commercial_offering ? Number(l.commercial_offering.purchase_price_ht) : undefined,
          }))
        : Array.from({ length: DEFAULT_LINE_COUNT }, () => emptyLine(defaultTva))
    while (lines.length < DEFAULT_LINE_COUNT) {
      lines.push(emptyLine(defaultTva))
    }
    setForm({
      client_id: quote.client_id,
      site_id: quote.site_id,
      quote_date: quote.quote_date?.slice(0, 10) ?? '',
      order_date: quote.order_date?.slice(0, 10) ?? '',
      site_delivery_date: quote.site_delivery_date?.slice(0, 10) ?? '',
      valid_until: quote.valid_until?.slice(0, 10) ?? '',
      tva_rate: defaultTva,
      discount_percent: Number(quote.discount_percent ?? 0),
      discount_amount: Number(quote.discount_amount ?? 0),
      shipping_amount_ht: Number(quote.shipping_amount_ht ?? 0),
      shipping_tva_rate: Number(quote.shipping_tva_rate ?? 20),
      travel_fee_ht: Number(quote.travel_fee_ht ?? 0),
      travel_fee_tva_rate: Number(quote.travel_fee_tva_rate ?? 20),
      apply_site_travel: false,
      billing_address_id: quote.billing_address_id,
      delivery_address_id: quote.delivery_address_id,
      pdf_template_id: quote.pdf_template_id,
      notes: quote.notes ?? '',
      lines,
    })
  }, [quote, isCreate, navigate])

  const createMutation = useMutation({
    mutationFn: (body: QuoteCreateBody) => quotesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      navigate('/devis')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: QuoteCreateBody }) => quotesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', editingNumericId] })
      navigate('/devis')
    },
  })

  const quoteMetaMut = useMutation({
    mutationFn: ({ id, meta }: { id: number; meta: EntityMetaPayload }) => quotesApi.update(id, { meta }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', editingNumericId] })
    },
  })

  const clients = Array.isArray(clientsData) ? clientsData : []
  const sites = Array.isArray(sitesData) ? sitesData : []
  const addressesForm = addrForm ?? []
  const quoteTemplates = tplQuote?.data ?? []

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, emptyLine(f.tva_rate ?? 20)],
    }))
  }

  const addEmptyLines = (n: number) => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, ...Array.from({ length: n }, () => emptyLine(f.tva_rate ?? 20))],
    }))
  }

  const updateLine = (index: number, field: keyof QuoteLineDraft, value: string | number | null) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }))
  }

  const removeLine = (index: number) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((_, i) => i !== index),
    }))
  }

  function applyOfferingToLine(index: number, o: CommercialOffering) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) =>
        i === index
          ? {
              ...l,
              commercial_offering_id: o.id,
              description: o.name,
              unit_price: Number(o.sale_price_ht),
              tva_rate: Number(o.default_tva_rate),
              purchase_ref_ht: Number(o.purchase_price_ht),
            }
          : l,
      ),
    }))
    setCatalogLineIndex(null)
    setCatalogSearch('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = toApiBody(form)
    if (form.client_id <= 0 || body.lines.length < 1) return
    if (isCreate) {
      createMutation.mutate({
        ...body,
        valid_until: form.valid_until || undefined,
        order_date: form.order_date || undefined,
        site_delivery_date: form.site_delivery_date || undefined,
        site_id: form.site_id || undefined,
        billing_address_id: form.billing_address_id || undefined,
        delivery_address_id: form.delivery_address_id || undefined,
        pdf_template_id: form.pdf_template_id || undefined,
        apply_site_travel: form.apply_site_travel || undefined,
      })
    } else if (editingNumericId) {
      updateMutation.mutate({
        id: editingNumericId,
        body: {
          ...body,
          valid_until: form.valid_until || undefined,
          order_date: form.order_date || undefined,
          site_delivery_date: form.site_delivery_date || undefined,
          site_id: form.site_id || undefined,
          billing_address_id: form.billing_address_id || undefined,
          delivery_address_id: form.delivery_address_id || undefined,
          pdf_template_id: form.pdf_template_id || undefined,
          apply_site_travel: form.apply_site_travel || undefined,
        },
      })
    }
  }

  const catalogRows = useMemo(() => catalogData?.data ?? [], [catalogData])

  if (!isLab) {
    return (
      <div className="container">
        <p>Accès réservé au laboratoire.</p>
      </div>
    )
  }

  if (!isCreate && loadingQuote) {
    return (
      <div className="container">
        <p>Chargement du devis…</p>
      </div>
    )
  }

  return (
    <div className="container quote-editor-page">
      <PageBackNav back={{ to: '/devis', label: 'Liste des devis' }} />
      <h1>{isCreate ? 'Nouveau devis' : `Modifier le devis ${quote?.number ?? ''}`}</h1>
      <p className="text-muted" style={{ maxWidth: '48rem' }}>
        Saisie sur une page dédiée. Utilisez le catalogue commercial pour préremplir prix et TVA ; vous pouvez ajuster le PV
        ligne par ligne. Les lignes vides ne sont pas enregistrées.
      </p>

      <form onSubmit={handleSubmit} className="card quote-editor-page__form">
        <QuoteFormFields
          form={form}
          setForm={setForm}
          clients={clients}
          sites={sites}
          addresses={addressesForm}
          quoteTemplates={quoteTemplates}
          addLine={addLine}
          addEmptyLines={addEmptyLines}
          updateLine={updateLine}
          removeLine={removeLine}
          onPickFromCatalog={(i) => {
            setCatalogLineIndex(i)
            setCatalogSearch('')
          }}
        />

        {!isCreate && quote && (
          <EntityMetaCard
            meta={quote.meta}
            editable
            onSave={(meta) => quoteMetaMut.mutateAsync({ id: quote.id, meta })}
            isSaving={quoteMetaMut.isPending}
            saveError={quoteMetaMut.isError ? (quoteMetaMut.error as Error).message : null}
          />
        )}

        {(createMutation.isError || updateMutation.isError) && (
          <p className="error">{((createMutation.error ?? updateMutation.error) as Error).message}</p>
        )}

        <div className="crud-actions" style={{ marginTop: '1.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Enregistrement…' : isCreate ? 'Créer le devis' : 'Enregistrer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/devis')}>
            Annuler
          </button>
        </div>
      </form>

      {catalogLineIndex !== null && (
        <Modal title="Choisir une référence catalogue" onClose={() => setCatalogLineIndex(null)}>
          <input
            type="search"
            placeholder="Filtrer…"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
          {catalogLoading ? (
            <p>Chargement…</p>
          ) : (
            <div className="catalog-picker-list">
              {catalogRows.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="catalog-picker-row"
                  onClick={() => applyOfferingToLine(catalogLineIndex, o)}
                >
                  <span className="catalog-picker-row__name">{o.name}</span>
                  <span className="catalog-picker-row__meta">
                    {o.code ? `${o.code} · ` : ''}
                    PV {formatMoney(Number(o.sale_price_ht))} (HT) · TVA {Number(o.default_tva_rate).toFixed(2)} %
                  </span>
                </button>
              ))}
              {catalogRows.length === 0 && <p className="text-muted">Aucun résultat. Gérez le catalogue dans le back-office.</p>}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
