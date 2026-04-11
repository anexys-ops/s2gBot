import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  quotesApi,
  clientsApi,
  sitesApi,
  clientAddressesApi,
  documentPdfTemplatesApi,
  pdfApi,
  type ClientAddress,
  type DocumentPdfTemplateRow,
  type QuoteCreateBody,
  type Site,
} from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  signed: 'Signé',
  sent: 'Envoyé',
  relanced: 'Relancé',
  lost: 'Perdu',
  invoiced: 'Facturé',
  accepted: 'Accepté',
  rejected: 'Refusé',
}

const emptyForm = (): QuoteCreateBody => ({
  client_id: 0,
  quote_date: new Date().toISOString().slice(0, 10),
  order_date: '',
  site_delivery_date: '',
  valid_until: '',
  tva_rate: 20,
  discount_percent: 0,
  discount_amount: 0,
  shipping_amount_ht: 0,
  shipping_tva_rate: 20,
  travel_fee_ht: 0,
  travel_fee_tva_rate: 20,
  apply_site_travel: false,
  notes: '',
  lines: [{ description: '', quantity: 1, unit_price: 0, tva_rate: 20, discount_percent: 0 }],
})

export default function Devis() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [statusModalId, setStatusModalId] = useState<number | null>(null)
  const [statusValue, setStatusValue] = useState('')
  const [form, setForm] = useState<QuoteCreateBody>(emptyForm())
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const { visible, toggle } = usePersistedColumnVisibility('quotes', {
    number: true,
    client: true,
    date: true,
    ttc: true,
    travel: true,
    status: true,
    pdf: true,
    actions: true,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', debouncedSearch, statusFilter, page],
    queryFn: () =>
      quotesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
      }),
  })

  const { data: editQuote } = useQuery({
    queryKey: ['quote', editingId],
    queryFn: () => quotesApi.get(editingId!),
    enabled: editingId !== null,
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

  const addressesForm = addrForm ?? []
  const quoteTemplates: DocumentPdfTemplateRow[] = tplQuote?.data ?? []

  useEffect(() => {
    if (!editQuote || editingId === null) return
    const ql = editQuote.quote_lines ?? []
    setForm({
      client_id: editQuote.client_id,
      site_id: editQuote.site_id,
      quote_date: editQuote.quote_date?.slice(0, 10) ?? '',
      order_date: editQuote.order_date?.slice(0, 10) ?? '',
      site_delivery_date: editQuote.site_delivery_date?.slice(0, 10) ?? '',
      valid_until: editQuote.valid_until?.slice(0, 10) ?? '',
      tva_rate: Number(editQuote.tva_rate),
      discount_percent: Number(editQuote.discount_percent ?? 0),
      discount_amount: Number(editQuote.discount_amount ?? 0),
      shipping_amount_ht: Number(editQuote.shipping_amount_ht ?? 0),
      shipping_tva_rate: Number(editQuote.shipping_tva_rate ?? 20),
      travel_fee_ht: Number(editQuote.travel_fee_ht ?? 0),
      travel_fee_tva_rate: Number(editQuote.travel_fee_tva_rate ?? 20),
      apply_site_travel: false,
      billing_address_id: editQuote.billing_address_id,
      delivery_address_id: editQuote.delivery_address_id,
      pdf_template_id: editQuote.pdf_template_id,
      notes: editQuote.notes ?? '',
      lines:
        ql.length > 0
          ? ql.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unit_price: Number(l.unit_price),
              tva_rate: Number(l.tva_rate ?? editQuote.tva_rate ?? 20),
              discount_percent: Number(l.discount_percent ?? 0),
            }))
          : [{ description: '', quantity: 1, unit_price: 0, tva_rate: 20, discount_percent: 0 }],
    })
  }, [editQuote, editingId])

  const createMutation = useMutation({
    mutationFn: (body: QuoteCreateBody) => quotesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setShowForm(false)
      setForm(emptyForm())
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: QuoteCreateBody }) => quotesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', editingId] })
      setEditingId(null)
      setForm(emptyForm())
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => quotesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setStatusModalId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  })

  const clients = Array.isArray(clientsData) ? clientsData : []
  const sites = Array.isArray(sitesData) ? sitesData : []
  const quotes = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { description: '', quantity: 1, unit_price: 0, tva_rate: f.tva_rate ?? 20, discount_percent: 0 }],
    }))
  }

  const updateLine = (index: number, field: string, value: string | number) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }))
  }

  const removeLine = (index: number) => {
    if (form.lines.length <= 1) return
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index),
    }))
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.client_id <= 0 || form.lines.some((l) => !l.description || l.quantity <= 0)) return
    createMutation.mutate({
      ...form,
      valid_until: form.valid_until || undefined,
      order_date: form.order_date || undefined,
      site_delivery_date: form.site_delivery_date || undefined,
      site_id: form.site_id || undefined,
      billing_address_id: form.billing_address_id || undefined,
      delivery_address_id: form.delivery_address_id || undefined,
      pdf_template_id: form.pdf_template_id || undefined,
      apply_site_travel: form.apply_site_travel || undefined,
    })
  }

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || form.client_id <= 0 || form.lines.some((l) => !l.description || l.quantity <= 0)) return
    updateMutation.mutate({
      id: editingId,
      body: {
        ...form,
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
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              if (!showForm) setForm(emptyForm())
            }}
          >
            {showForm ? 'Annuler' : 'Nouveau devis'}
          </button>
          {showForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3>Créer un devis</h3>
              <form onSubmit={handleSubmitCreate}>
                <QuoteFormFields
                  form={form}
                  setForm={setForm}
                  clients={clients}
                  sites={sites}
                  addresses={addressesForm}
                  quoteTemplates={quoteTemplates}
                  addLine={addLine}
                  updateLine={updateLine}
                  removeLine={removeLine}
                />
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || form.client_id <= 0}>
                  {createMutation.isPending ? 'Création...' : 'Créer le devis'}
                </button>
                {createMutation.isError && <span className="error"> {(createMutation.error as Error).message}</span>}
              </form>
            </div>
          )}
        </>
      )}

      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        searchPlaceholder="Numéro, notes…"
        statusValue={statusFilter}
        onStatusChange={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
        statusOptions={statusOptions}
        columns={[
          { id: 'number', label: 'Numéro' },
          { id: 'client', label: 'Client' },
          { id: 'date', label: 'Date' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
          { id: 'status', label: 'Statut' },
          ...(isLab ? [{ id: 'pdf', label: 'PDF' }] : []),
          ...(isLab ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              {visible.number !== false && <th>Numéro</th>}
              {visible.client !== false && <th>Client</th>}
              {visible.date !== false && <th>Date</th>}
              {visible.ttc !== false && <th>Montant TTC (€)</th>}
              {visible.travel !== false && <th>Dépl. HT</th>}
              {visible.status !== false && <th>Statut</th>}
              {isLab && visible.pdf !== false && <th>PDF</th>}
              {isLab && visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                {visible.number !== false && <td>{q.number}</td>}
                {visible.client !== false && <td>{q.client?.name}</td>}
                {visible.date !== false && <td>{new Date(q.quote_date).toLocaleDateString('fr-FR')}</td>}
                {visible.ttc !== false && <td>{Number(q.amount_ttc).toFixed(2)}</td>}
                {visible.travel !== false && <td>{Number(q.travel_fee_ht ?? 0).toFixed(2)}</td>}
                {visible.status !== false && <td>{STATUS_LABELS[q.status] ?? q.status}</td>}
                {isLab && visible.pdf !== false && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => pdfApi.generate('quote', q.id, q.pdf_template_id)}
                    >
                      PDF
                    </button>
                  </td>
                )}
                {isLab && visible.actions !== false && (
                  <td>
                    <div className="crud-actions">
                      {q.status === 'draft' && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingId(q.id)}>
                          Modifier
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setStatusModalId(q.id)
                          setStatusValue(q.status)
                        }}
                      >
                        Statut
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm(`Supprimer le devis ${q.number} ?`)) deleteMutation.mutate(q.id)
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {quotes.length === 0 && <p style={{ padding: '1rem' }}>Aucun devis.</p>}
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

      {editingId !== null && (
        <Modal title="Modifier le devis" onClose={() => setEditingId(null)}>
          {!editQuote ? (
            <p>Chargement…</p>
          ) : (
            <form onSubmit={handleSubmitEdit}>
              <QuoteFormFields
                form={form}
                setForm={setForm}
                clients={clients}
                sites={sites}
                addresses={addressesForm}
                quoteTemplates={quoteTemplates}
                addLine={addLine}
                updateLine={updateLine}
                removeLine={removeLine}
              />
              {updateMutation.isError && <p className="error">{(updateMutation.error as Error).message}</p>}
              <div className="crud-actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                  Enregistrer
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)}>
                  Annuler
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {statusModalId !== null && (
        <Modal title="Changer le statut" onClose={() => setStatusModalId(null)}>
          <div className="form-group">
            <label>Statut</label>
            <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="crud-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: statusModalId, status: statusValue })}
            >
              Enregistrer
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStatusModalId(null)}>
              Annuler
            </button>
          </div>
          {statusMutation.isError && <p className="error">{(statusMutation.error as Error).message}</p>}
        </Modal>
      )}
    </div>
  )
}

function QuoteFormFields({
  form,
  setForm,
  clients,
  sites,
  addresses,
  quoteTemplates,
  addLine,
  updateLine,
  removeLine,
}: {
  form: QuoteCreateBody
  setForm: React.Dispatch<React.SetStateAction<QuoteCreateBody>>
  clients: { id: number; name: string }[]
  sites: Site[]
  addresses: ClientAddress[]
  quoteTemplates: DocumentPdfTemplateRow[]
  addLine: () => void
  updateLine: (i: number, f: string, v: string | number) => void
  removeLine: (i: number) => void
}) {
  const addrLabel = (a: ClientAddress) =>
    `${a.type}${a.label ? ` — ${a.label}` : ''} : ${a.line1}, ${a.postal_code ?? ''} ${a.city ?? ''}`

  const selectedSite = sites.find((s) => s.id === form.site_id)

  return (
    <>
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
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chantier
          <select
            value={form.site_id ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value ? Number(e.target.value) : undefined }))}
          >
            <option value="">—</option>
            {sites.filter((s) => s.client_id === form.client_id).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date devis *
          <input
            type="date"
            value={form.quote_date}
            onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))}
            required
          />
        </label>
        <label>
          Date de commande
          <input
            type="date"
            value={form.order_date ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
          />
        </label>
        <label>
          Livraison chantier
          <input
            type="date"
            value={form.site_delivery_date ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, site_delivery_date: e.target.value }))}
          />
        </label>
        <label>
          Valide jusqu&apos;au
          <input
            type="date"
            value={form.valid_until ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
          />
        </label>
        <label>
          TVA par défaut (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.tva_rate ?? 20}
            onChange={(e) => setForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
          />
        </label>
        <label>
          Remise doc (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.discount_percent ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, discount_percent: Number(e.target.value) }))}
          />
        </label>
        <label>
          Remise doc (€ HT)
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.discount_amount ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, discount_amount: Number(e.target.value) }))}
          />
        </label>
        <label>
          Frais port / livraison HT
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.shipping_amount_ht ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, shipping_amount_ht: Number(e.target.value) }))}
          />
        </label>
        <label>
          TVA sur frais de port (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.shipping_tva_rate ?? 20}
            onChange={(e) => setForm((f) => ({ ...f, shipping_tva_rate: Number(e.target.value) }))}
          />
        </label>
        {selectedSite && Number(selectedSite.travel_fee_quote_ht ?? 0) > 0 && (
          <p style={{ gridColumn: '1 / -1', fontSize: '0.85rem', margin: 0, color: 'var(--muted, #64748b)' }}>
            Forfait déplacement chantier (estimation devis) : {Number(selectedSite.travel_fee_quote_ht).toFixed(2)} € HT
            {selectedSite.travel_fee_label ? ` — ${selectedSite.travel_fee_label}` : ''}
          </p>
        )}
        <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={form.apply_site_travel ?? false}
            onChange={(e) => setForm((f) => ({ ...f, apply_site_travel: e.target.checked }))}
          />
          Appliquer le forfait déplacement du chantier sur ce devis
        </label>
        <label>
          Frais déplacement HT (manuel)
          <input
            type="number"
            min={0}
            step={0.01}
            disabled={form.apply_site_travel}
            value={form.travel_fee_ht ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, travel_fee_ht: Number(e.target.value) }))}
          />
        </label>
        <label>
          TVA sur déplacement (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            disabled={form.apply_site_travel}
            value={form.travel_fee_tva_rate ?? 20}
            onChange={(e) => setForm((f) => ({ ...f, travel_fee_tva_rate: Number(e.target.value) }))}
          />
        </label>
        <label>
          Adresse facturation
          <select
            value={form.billing_address_id ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                billing_address_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">—</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {addrLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Adresse livraison
          <select
            value={form.delivery_address_id ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                delivery_address_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">—</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {addrLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Modèle PDF
          <select
            value={form.pdf_template_id ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                pdf_template_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">Défaut</option>
            {quoteTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_default ? ' (défaut)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
      </label>
      <h4 style={{ marginTop: '1rem' }}>Lignes (TVA et remise par ligne)</h4>
      {form.lines.map((line, index) => (
        <div
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px,1fr) 56px 72px 56px 56px 72px auto',
            gap: '0.35rem',
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
            title="Qté"
            min={1}
            value={line.quantity}
            onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))}
          />
          <input
            type="number"
            title="PU HT"
            min={0}
            step={0.01}
            value={line.unit_price}
            onChange={(e) => updateLine(index, 'unit_price', Number(e.target.value))}
          />
          <input
            type="number"
            title="Remise %"
            min={0}
            max={100}
            step={0.01}
            value={line.discount_percent ?? 0}
            onChange={(e) => updateLine(index, 'discount_percent', Number(e.target.value))}
          />
          <input
            type="number"
            title="TVA %"
            min={0}
            max={100}
            step={0.01}
            value={line.tva_rate ?? form.tva_rate ?? 20}
            onChange={(e) => updateLine(index, 'tva_rate', Number(e.target.value))}
          />
          <span style={{ fontSize: '0.8rem' }}>
            {(
              (line.quantity || 0) *
              (line.unit_price || 0) *
              (1 - (line.discount_percent ?? 0) / 100)
            ).toFixed(2)}{' '}
            € HT
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeLine(index)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={addLine} style={{ marginBottom: '1rem' }}>
        + Ligne
      </button>
    </>
  )
}
