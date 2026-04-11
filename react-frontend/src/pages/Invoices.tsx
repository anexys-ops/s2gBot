import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi, ordersApi, pdfApi, type EntityMetaPayload, type Invoice } from '../api/client'
import EntityMetaCard from '../components/module/EntityMetaCard'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  signed: 'Signée',
  sent: 'Envoyée',
  relanced: 'Relancée',
  paid: 'Encaissée',
}

export default function Invoices() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
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
  })
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', debouncedSearch, statusFilter, page],
    queryFn: () =>
      invoicesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
      }),
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'invoice-picker'],
    queryFn: () => ordersApi.list({ page: 1 }),
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
  const invoices = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

  const toggleOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const openEdit = (inv: Invoice) => {
    setEditInvoice(inv)
    setEditForm({
      status: inv.status,
      invoice_date: inv.invoice_date?.slice(0, 10) ?? '',
      due_date: inv.due_date?.slice(0, 10) ?? '',
      amount_ht: Number(inv.amount_ht),
      tva_rate: Number(inv.tva_rate),
      travel_fee_ht: Number(inv.travel_fee_ht ?? 0),
      travel_fee_tva_rate: Number(inv.travel_fee_tva_rate ?? 20),
    })
  }

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInvoice) return
    if (editInvoice.status !== 'draft') {
      updateMutation.mutate({
        id: editInvoice.id,
        body: {
          status: editForm.status,
          due_date: editForm.due_date || undefined,
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
      },
    })
  }

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur : {String(error)}</p>

  return (
    <div>
      <h1>Factures</h1>
      {isLab && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>Créer une facture à partir de commandes</h3>
          <p>Sélectionnez une ou plusieurs commandes (même client) :</p>
          <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
            {orders
              .filter((o) => o.status === 'completed' || o.status === 'in_progress')
              .map((o) => (
                <label key={o.id} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(o.id)}
                    onChange={() => toggleOrder(o.id)}
                  />{' '}
                  {o.reference} — {o.client?.name}
                </label>
              ))}
          </div>
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
        columns={[
          { id: 'number', label: 'Numéro' },
          { id: 'client', label: 'Client' },
          { id: 'date', label: 'Date' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
          { id: 'status', label: 'Statut' },
          ...(isLab ? [{ id: 'pdf', label: 'PDF' }] : []),
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
              {visible.ttc !== false && <th>Montant TTC (€)</th>}
              {visible.travel !== false && <th>Dépl. HT</th>}
              {visible.status !== false && <th>Statut</th>}
              {isLab && visible.pdf !== false && <th>PDF</th>}
              {isAdmin && visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                {visible.number !== false && <td>{inv.number}</td>}
                {visible.client !== false && <td>{inv.client?.name}</td>}
                {visible.date !== false && <td>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</td>}
                {visible.ttc !== false && <td>{Number(inv.amount_ttc).toFixed(2)}</td>}
                {visible.travel !== false && <td>{Number(inv.travel_fee_ht ?? 0).toFixed(2)}</td>}
                {visible.status !== false && <td>{STATUS_LABELS[inv.status] ?? inv.status}</td>}
                {isLab && visible.pdf !== false && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => pdfApi.generate('invoice', inv.id, inv.pdf_template_id)}
                    >
                      PDF
                    </button>
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
            {editInvoice.status === 'draft' && (
              <>
                <div className="form-group">
                  <label>Montant HT (€)</label>
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
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={editForm.tva_rate}
                    onChange={(e) => setEditForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
                  />
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
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={editForm.travel_fee_tva_rate}
                    onChange={(e) => setEditForm((f) => ({ ...f, travel_fee_tva_rate: Number(e.target.value) }))}
                  />
                </div>
              </>
            )}
            {editInvoice.status !== 'draft' && (
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                Hors brouillon : seuls le statut et l&apos;échéance sont modifiables (aligné API).
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
          </>
        </Modal>
      )}
    </div>
  )
}
