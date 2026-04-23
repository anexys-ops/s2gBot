import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  clientContactsApi,
  clientsApi,
  documentPdfTemplatesApi,
  invoicesApi,
  moduleSettingsApi,
  ordersApi,
  pdfApi,
  type EntityMetaPayload,
  type Invoice,
} from '../api/client'
import EntityMetaCard from '../components/module/EntityMetaCard'
import ExtrafieldsForm from '../components/module/ExtrafieldsForm'
import PageBackNav from '../components/PageBackNav'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  signed: 'Signée',
  sent: 'Envoyée',
  relanced: 'Relancée',
  paid: 'Encaissée',
}

const DEFAULT_TVA_OPTIONS = [20, 10, 5.5, 0]

function numList(v: unknown): number[] {
  if (!Array.isArray(v) || v.length === 0) return DEFAULT_TVA_OPTIONS
  const out = v.map((x) => Number(x)).filter((n) => !Number.isNaN(n))
  return out.length ? out : DEFAULT_TVA_OPTIONS
}

export default function Invoices() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([])
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [editForm, setEditForm] = useState({
    status: 'draft',
    invoice_date: '',
    due_date: '',
    amount_ht: 0,
    tva_rate: 20,
    travel_fee_ht: 0,
    travel_fee_tva_rate: 20,
    pdf_template_id: '' as number | '',
    contact_id: '' as number | '',
  })
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [page, setPage] = useState(1)
  const { visible, toggle } = usePersistedColumnVisibility('invoices', {
    number: true,
    client: true,
    date: true,
    ttc: true,
    travel: true,
    status: true,
    pdf: true,
    actions: true,
  })

  const { data: modInvoices } = useQuery({
    queryKey: ['module-settings', 'invoices'],
    queryFn: () => moduleSettingsApi.get('invoices'),
    enabled: isLab,
  })

  const tvaOptions = useMemo(() => numList(modInvoices?.settings?.tva_rate_options), [modInvoices])
  const travelTvaOptions = useMemo(() => numList(modInvoices?.settings?.travel_tva_rate_options), [modInvoices])
  const tvaOptionsForEdit = useMemo(() => {
    const base = [...tvaOptions]
    if (editInvoice && !base.includes(editForm.tva_rate)) base.push(editForm.tva_rate)
    return [...new Set(base)].sort((a, b) => b - a)
  }, [tvaOptions, editInvoice, editForm.tva_rate])
  const travelTvaOptionsForEdit = useMemo(() => {
    const base = [...travelTvaOptions]
    if (editInvoice && !base.includes(editForm.travel_fee_tva_rate)) base.push(editForm.travel_fee_tva_rate)
    return [...new Set(base)].sort((a, b) => b - a)
  }, [travelTvaOptions, editInvoice, editForm.travel_fee_tva_rate])
  const orderPickerStatuses = useMemo(() => {
    const s = modInvoices?.settings?.order_picker_statuses
    if (Array.isArray(s) && s.length > 0) return s as string[]
    return ['completed', 'in_progress']
  }, [modInvoices])

  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients', 'invoices-toolbar'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
  })

  const { data: pdfTplData } = useQuery({
    queryKey: ['document-pdf-templates', 'invoice'],
    queryFn: () => documentPdfTemplatesApi.list('invoice'),
    enabled: isLab && !!editInvoice,
  })
  const pdfTemplates = pdfTplData?.data ?? []

  const { data: invoiceEditContacts = [] } = useQuery({
    queryKey: ['client-contacts', 'invoice-edit', editInvoice?.client_id],
    queryFn: () => clientContactsApi.list(editInvoice!.client_id),
    enabled: isLab && !!editInvoice && editInvoice.client_id > 0,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', debouncedSearch, statusFilter, clientFilter, page],
    queryFn: () =>
      invoicesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
        client_id: clientFilter ? Number(clientFilter) : undefined,
      }),
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'invoice-picker'],
    queryFn: () => ordersApi.list({ page: 1, per_page: 100 }),
    enabled: isLab,
  })

  const fromOrdersMutation = useMutation({
    mutationFn: (orderIds: number[]) => invoicesApi.fromOrders(orderIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setSelectedOrderIds([])
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Invoice> }) => invoicesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setEditInvoice(null)
    },
  })

  const invoiceMetaMut = useMutation({
    mutationFn: ({ id, meta }: { id: number; meta: EntityMetaPayload }) => invoicesApi.update(id, { meta }),
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setEditInvoice((prev) => (prev && prev.id === variables.id ? updated : prev))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })

  const orders = ordersData?.data ?? []
  const pickableOrders = orders.filter((o) => orderPickerStatuses.includes(o.status))
  const invoices = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

  const openEdit = useCallback((inv: Invoice) => {
    setEditInvoice(inv)
    setEditForm({
      status: inv.status,
      invoice_date: inv.invoice_date?.slice(0, 10) ?? '',
      due_date: inv.due_date?.slice(0, 10) ?? '',
      amount_ht: Number(inv.amount_ht),
      tva_rate: Number(inv.tva_rate),
      travel_fee_ht: Number(inv.travel_fee_ht ?? 0),
      travel_fee_tva_rate: Number(inv.travel_fee_tva_rate ?? 20),
      pdf_template_id: inv.pdf_template_id ?? '',
      contact_id: inv.contact_id != null && inv.contact_id > 0 ? inv.contact_id : '',
    })
  }, [])

  const editFromQuery = searchParams.get('edit')
  useEffect(() => {
    if (!editFromQuery || !isAdmin) return
    const id = Number(editFromQuery)
    if (!Number.isFinite(id) || id <= 0) return
    let cancelled = false
    void invoicesApi
      .get(id)
      .then((inv) => {
        if (cancelled) return
        openEdit(inv)
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev)
            n.delete('edit')
            return n
          },
          { replace: true },
        )
      })
      .catch(() => {
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev)
            n.delete('edit')
            return n
          },
          { replace: true },
        )
      })
    return () => {
      cancelled = true
    }
  }, [editFromQuery, isAdmin, openEdit, setSearchParams])

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInvoice) return
    if (editInvoice.status !== 'draft') {
      updateMutation.mutate({
        id: editInvoice.id,
        body: {
          status: editForm.status,
          due_date: editForm.due_date || undefined,
          pdf_template_id: editForm.pdf_template_id === '' ? undefined : editForm.pdf_template_id,
          contact_id: editForm.contact_id === '' ? undefined : editForm.contact_id,
        },
      })
      return
    }
    updateMutation.mutate({
      id: editInvoice.id,
      body: {
        status: editForm.status,
        invoice_date: editForm.invoice_date,
        due_date: editForm.due_date || undefined,
        amount_ht: editForm.amount_ht,
        tva_rate: editForm.tva_rate,
        travel_fee_ht: editForm.travel_fee_ht,
        travel_fee_tva_rate: editForm.travel_fee_tva_rate,
        pdf_template_id: editForm.pdf_template_id === '' ? undefined : editForm.pdf_template_id,
        contact_id: editForm.contact_id === '' ? undefined : editForm.contact_id,
      },
    })
  }

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur : {String(error)}</p>

  return (
    <div>
      <PageBackNav
        back={{ to: '/', label: 'Tableau de bord' }}
        extras={[
          { to: '/crm', label: 'Commercial' },
          { to: '/crm/documents', label: 'Registre documents' },
          ...(isAdmin ? [{ to: '/back-office/configuration', label: 'Configuration' }] : []),
        ]}
      />
      <h1>Factures</h1>
      {isLab && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>Créer une facture à partir de commandes</h3>
          <p>
            Sélectionnez une ou plusieurs commandes (même client). Les statuts proposés sont configurables dans le back
            office → Configuration → Listes par module → Factures.
          </p>
          <label className="form-group" style={{ display: 'block', maxWidth: 520 }}>
            <span style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Commandes (liste déroulante multiple)</span>
            <select
              multiple
              className="invoice-orders-multiselect"
              size={Math.min(12, Math.max(6, pickableOrders.length))}
              value={selectedOrderIds.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (opt) => Number(opt.value))
                setSelectedOrderIds(selected)
              }}
            >
              {pickableOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.reference} — {o.client?.name ?? 'Client'} ({o.status})
                </option>
              ))}
            </select>
          </label>
          {pickableOrders.length === 0 && (
            <p style={{ color: 'var(--color-muted, #64748b)' }}>Aucune commande ne correspond aux statuts configurés.</p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedOrderIds.length === 0 || fromOrdersMutation.isPending}
            onClick={() => fromOrdersMutation.mutate(selectedOrderIds)}
          >
            {fromOrdersMutation.isPending ? 'Création...' : 'Créer la facture'}
          </button>
          {fromOrdersMutation.isError && (
            <span className="error"> {(fromOrdersMutation.error as Error).message}</span>
          )}
        </div>
      )}
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        searchPlaceholder="Numéro, client…"
        statusValue={statusFilter}
        onStatusChange={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
        statusOptions={statusOptions}
        extra={
          isLab ? (
            <label style={{ minWidth: 200, margin: 0 }}>
              <span
                style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--color-muted, #64748b)' }}
              >
                Client
              </span>
              <select
                value={clientFilter}
                onChange={(e) => {
                  setClientFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Tous les clients</option>
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        columns={[
          { id: 'number', label: 'Numéro' },
          { id: 'client', label: 'Client' },
          { id: 'date', label: 'Date' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
          { id: 'status', label: 'Statut' },
          { id: 'pdf', label: 'PDF' },
          ...(isAdmin ? [{ id: 'actions', label: 'Actions' }] : []),
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
              {visible.ttc !== false && <th>Montant TTC ({MONEY_UNIT_LABEL})</th>}
              {visible.travel !== false && <th>Dépl. HT ({MONEY_UNIT_LABEL})</th>}
              {visible.status !== false && <th>Statut</th>}
              {visible.pdf !== false && <th>PDF</th>}
              {isAdmin && visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                {visible.number !== false && <td>{inv.number}</td>}
                {visible.client !== false && <td>{inv.client?.name}</td>}
                {visible.date !== false && <td>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</td>}
                {visible.ttc !== false && <td>{formatMoney(Number(inv.amount_ttc))}</td>}
                {visible.travel !== false && <td>{formatMoney(Number(inv.travel_fee_ht ?? 0))}</td>}
                {visible.status !== false && <td>{STATUS_LABELS[inv.status] ?? inv.status}</td>}
                {visible.pdf !== false && (
                  <td>
                    {isLab ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => pdfApi.generate('invoice', inv.id, inv.pdf_template_id)}
                      >
                        PDF
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => invoicesApi.openInvoicePdf(inv.id)}
                      >
                        Télécharger PDF
                      </button>
                    )}
                  </td>
                )}
                {isAdmin && visible.actions !== false && (
                  <td>
                    <div className="crud-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(inv)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer la facture ${inv.number} ?`)) deleteMutation.mutate(inv.id)
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <p style={{ padding: '1rem' }}>Aucune facture.</p>}
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

      {editInvoice && (
        <Modal title={`Modifier ${editInvoice.number}`} onClose={() => setEditInvoice(null)}>
          <>
          <form onSubmit={submitEdit}>
            <div className="form-group">
              <label>Statut</label>
              <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {editInvoice.status === 'draft' && (
              <div className="form-group">
                <label>Date facture</label>
                <input
                  type="date"
                  value={editForm.invoice_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, invoice_date: e.target.value }))}
                />
              </div>
            )}
            <div className="form-group">
              <label>Échéance</label>
              <input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Modèle PDF facture</label>
              <select
                value={editForm.pdf_template_id === '' ? '' : String(editForm.pdf_template_id)}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    pdf_template_id: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              >
                <option value="">— Par défaut —</option>
                {pdfTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_default ? ' (défaut)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Contact client</label>
              <select
                value={editForm.contact_id === '' ? '' : String(editForm.contact_id)}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    contact_id: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              >
                <option value="">—</option>
                {invoiceEditContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.prenom, c.nom].filter(Boolean).join(' ').trim() || `Contact #${c.id}`}
                    {c.email ? ` — ${c.email}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {editInvoice.status === 'draft' && (
              <>
                <div className="form-group">
                  <label>Montant HT ({MONEY_UNIT_LABEL})</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.amount_ht}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount_ht: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label>TVA (%)</label>
                  <select
                    value={String(editForm.tva_rate)}
                    onChange={(e) => setEditForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
                  >
                    {tvaOptionsForEdit.map((n) => (
                      <option key={n} value={n}>
                        {n} %
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Frais déplacement HT</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.travel_fee_ht}
                    onChange={(e) => setEditForm((f) => ({ ...f, travel_fee_ht: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label>TVA sur déplacement (%)</label>
                  <select
                    value={String(editForm.travel_fee_tva_rate)}
                    onChange={(e) => setEditForm((f) => ({ ...f, travel_fee_tva_rate: Number(e.target.value) }))}
                  >
                    {travelTvaOptionsForEdit.map((n) => (
                      <option key={n} value={n}>
                        {n} %
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {editInvoice.status !== 'draft' && (
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                Hors brouillon : statut, échéance et modèle PDF sont modifiables ; le reste est figé (API).
              </p>
            )}
            {updateMutation.isError && <p className="error">{(updateMutation.error as Error).message}</p>}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditInvoice(null)}>
                Annuler
              </button>
            </div>
          </form>
          {isAdmin && (
            <EntityMetaCard
              meta={editInvoice.meta}
              editable
              onSave={(meta) => invoiceMetaMut.mutateAsync({ id: editInvoice.id, meta })}
              isSaving={invoiceMetaMut.isPending}
              saveError={invoiceMetaMut.isError ? (invoiceMetaMut.error as Error).message : null}
            />
          )}
          {isAdmin && (
            <ExtrafieldsForm entityType="invoice" entityId={editInvoice.id} canEdit title="Champs configurés (extrafields)" />
          )}
          </>
        </Modal>
      )}
    </div>
  )
}
