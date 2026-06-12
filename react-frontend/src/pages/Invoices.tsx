import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  clientContactsApi,
  clientsApi,
  documentPdfTemplatesApi,
  invoicesApi,
  moduleSettingsApi,
  pdfApi,
  type EntityMetaPayload,
  type Invoice,
} from '../api/client'
import { QuotePdfButton } from '../components/crm/QuoteListTableActions'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge, { bonCommandeStatutBadgeProps, invoiceStatutBadgeProps } from '../components/ds/StatusBadge'
import Toast, { toastErrorMessage, type ToastVariant } from '../components/Toast'
import EntityMetaCard from '../components/module/EntityMetaCard'
import ExtrafieldsForm from '../components/module/ExtrafieldsForm'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import TableRowActions from '../components/TableRowActions'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'

const BC_STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  livre: 'Livré',
  annule: 'Annulé',
}

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

function InvoiceCreateFromBcPanel({ onNotify }: { onNotify: (message: string, variant: ToastVariant) => void }) {
  const queryClient = useQueryClient()
  const [selectedBcIds, setSelectedBcIds] = useState<number[]>([])
  const [orderSearchInput, setOrderSearchInput] = useState('')
  const debouncedOrderSearch = useDebouncedValue(orderSearchInput, 250)

  const { data: eligibleBcData, isLoading } = useQuery({
    queryKey: ['invoices', 'eligible-bons-commande', debouncedOrderSearch],
    queryFn: () =>
      invoicesApi.eligibleBonsCommande({
        search: debouncedOrderSearch.trim() || undefined,
        limit: 100,
      }),
  })

  const fromBonsCommandeMutation = useMutation({
    mutationFn: (bcIds: number[]) => invoicesApi.fromBonsCommande(bcIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      void queryClient.invalidateQueries({ queryKey: ['invoices', 'eligible-bons-commande'] })
      setSelectedBcIds([])
      setOrderSearchInput('')
      onNotify('Facture créée en brouillon.', 'success')
    },
    onError: (err) => {
      onNotify(toastErrorMessage(err, 'Échec de la création de la facture.'), 'error')
    },
  })

  const eligibleBonsCommande = eligibleBcData?.data ?? []
  const selectedBcs = useMemo(
    () => eligibleBonsCommande.filter((bc) => selectedBcIds.includes(bc.id)),
    [eligibleBonsCommande, selectedBcIds],
  )

  const toggleBcSelection = (bcId: number) => {
    setSelectedBcIds((cur) => (cur.includes(bcId) ? cur.filter((id) => id !== bcId) : [...cur, bcId]))
    fromBonsCommandeMutation.reset()
  }

  return (
    <section className="card bc-from-devis-panel" aria-labelledby="invoice-from-bc-title">
      <header className="bc-from-devis-panel__header">
        <h2 id="invoice-from-bc-title" className="bc-from-devis-panel__title">
          Créer depuis un bon de commande
        </h2>
        <p className="bc-from-devis-panel__intro text-muted">
          Sélectionnez un ou plusieurs bons de commande non encore facturés (même client). Statuts éligibles
          configurables dans Configuration → Factures.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted bc-from-devis-panel__status">Chargement des bons de commande éligibles…</p>
      ) : eligibleBonsCommande.length === 0 ? (
        <div className="bc-from-devis-panel__empty dossier-tab-empty">
          <p>Aucun bon de commande éligible pour le moment.</p>
          <ul className="bc-from-devis-panel__criteria">
            <li>Statut : confirmé, en cours ou livré</li>
            <li>Pas encore lié à une facture</li>
            <li>Au moins une ligne de commande</li>
          </ul>
          <p className="bc-from-devis-panel__empty-actions">
            <Link to="/bons-commande" className="btn btn-secondary btn-sm">
              Voir les bons de commande
            </Link>
          </p>
        </div>
      ) : (
        <div className="bc-from-devis-panel__body">
          <div className="bc-from-devis-panel__form">
            <label className="form-group bc-from-devis-panel__field">
              <span className="bc-from-devis-panel__label">Rechercher un BC</span>
              <input
                type="search"
                value={orderSearchInput}
                onChange={(e) => setOrderSearchInput(e.target.value)}
                placeholder="Numéro BC, client, dossier…"
                autoComplete="off"
              />
            </label>

            <div className="invoice-orders-picker__list" role="listbox" aria-multiselectable="true">
              {eligibleBonsCommande.map((bc) => {
                const selected = selectedBcIds.includes(bc.id)
                const st = bonCommandeStatutBadgeProps(bc.statut)
                return (
                  <button
                    key={bc.id}
                    type="button"
                    className={`invoice-orders-picker__option${selected ? ' invoice-orders-picker__option--selected' : ''}`}
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggleBcSelection(bc.id)}
                  >
                    <span className="invoice-orders-picker__checkbox" aria-hidden="true">
                      {selected ? '✓' : ''}
                    </span>
                    <span>
                      <strong>{bc.numero}</strong> — {bc.client?.name ?? 'Client'}
                      {bc.dossier ? (
                        <span className="invoice-orders-picker__status"> ({bc.dossier.reference})</span>
                      ) : null}
                      <span className="invoice-orders-picker__status">
                        {' '}
                        — {BC_STATUT_LABELS[bc.statut] ?? st.label} — {formatMoney(Number(bc.montant_ht))} HT
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {selectedBcIds.length > 0 ? (
              <p className="invoice-orders-picker__summary">{selectedBcIds.length} bon(s) de commande sélectionné(s)</p>
            ) : null}

            <div className="bc-from-devis-panel__actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedBcIds.length === 0 || fromBonsCommandeMutation.isPending}
                onClick={() => fromBonsCommandeMutation.mutate(selectedBcIds)}
              >
                {fromBonsCommandeMutation.isPending ? 'Création en cours…' : 'Créer la facture'}
              </button>
              {selectedBcIds.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={fromBonsCommandeMutation.isPending}
                  onClick={() => {
                    setSelectedBcIds([])
                    fromBonsCommandeMutation.reset()
                  }}
                >
                  Effacer la sélection
                </button>
              ) : null}
            </div>

            {fromBonsCommandeMutation.isError ? (
              <p className="error bc-from-devis-panel__error">{(fromBonsCommandeMutation.error as Error).message}</p>
            ) : null}
          </div>

          {selectedBcs.length > 0 ? (
            <aside className="bc-from-devis-panel__preview" aria-label="Bons de commande sélectionnés">
              <h3 className="bc-from-devis-panel__preview-title">Sélection ({selectedBcs.length})</h3>
              <dl className="bc-from-devis-panel__meta">
                {selectedBcs.map((bc) => (
                  <div key={bc.id}>
                    <dt>{bc.numero}</dt>
                    <dd>
                      {bc.client?.name ?? 'Client'}
                      {bc.dossier ? ` — ${bc.dossier.reference}` : ''}
                      <br />
                      {formatMoney(Number(bc.montant_ht))} HT
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          ) : (
            <aside className="bc-from-devis-panel__hint text-muted">
              Sélectionnez un ou plusieurs bons de commande pour créer une facture brouillon.
            </aside>
          )}
        </div>
      )}
    </section>
  )
}

export default function Invoices() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
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

  const shellProps = {
    shellClassName: 'module-shell--crm' as const,
    breadcrumbs: [
      { label: 'Accueil', to: '/' },
      { label: 'Commercial', to: '/crm' },
      { label: 'Factures' },
    ],
    moduleBarLabel: 'Commercial — Factures',
    title: 'Factures',
    subtitle: 'Facturation client : création depuis les bons de commande, suivi des montants et des statuts.',
  }

  const showToast = (message: string, variant: ToastVariant) => {
    setToast({ message, variant })
  }

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
    placeholderData: keepPreviousData,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Invoice> }) => invoicesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setEditInvoice(null)
      showToast('Facture enregistrée.', 'success')
    },
    onError: (err) => {
      showToast(toastErrorMessage(err, 'Échec de l’enregistrement de la facture.'), 'error')
    },
  })

  const invoiceMetaMut = useMutation({
    mutationFn: ({ id, meta }: { id: number; meta: EntityMetaPayload }) => invoicesApi.update(id, { meta }),
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setEditInvoice((prev) => (prev && prev.id === variables.id ? updated : prev))
      showToast('Métadonnées enregistrées.', 'success')
    },
    onError: (err) => {
      showToast(toastErrorMessage(err, 'Échec de l’enregistrement des métadonnées.'), 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setDeleteTarget(null)
      showToast('Facture supprimée.', 'success')
    },
    onError: (err) => {
      showToast(toastErrorMessage(err, 'Échec de la suppression de la facture.'), 'error')
    },
  })

  const invoices = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const hasActiveFilters = searchInput.trim() !== '' || statusFilter !== '' || clientFilter !== ''

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

  if (isLoading && !data) {
    return (
      <ModuleEntityShell {...shellProps} subtitle="Chargement…">
        <p className="text-muted">Chargement des factures…</p>
      </ModuleEntityShell>
    )
  }

  if (error) {
    return (
      <ModuleEntityShell {...shellProps}>
        <p className="error">Erreur : {String(error)}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      {...shellProps}
      actions={
        isAdmin ? (
          <Link to="/back-office/configuration" className="btn btn-secondary btn-sm">
            Configuration
          </Link>
        ) : null
      }
    >
      {isLab ? <InvoiceCreateFromBcPanel onNotify={showToast} /> : null}

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
            <label>
              <span>Client</span>
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
        footer={
          hasActiveFilters ? (
            <>
              <span className="list-table-toolbar__footer-label">Filtres actifs</span>
              {searchInput.trim() !== '' ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">Recherche : « {searchInput.trim()} »</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setSearchInput('')}
                    aria-label="Effacer la recherche"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {statusFilter ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">{STATUS_LABELS[statusFilter] ?? statusFilter}</span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setStatusFilter('')}
                    aria-label="Effacer le filtre statut"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {clientFilter ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    {clientsList.find((c) => String(c.id) === clientFilter)?.name ?? `Client #${clientFilter}`}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setClientFilter('')}
                    aria-label="Effacer le filtre client"
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </>
          ) : null
        }
      />

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        {invoices.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.number !== false && <th>Numéro</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.ttc !== false && <th className="data-table__num">Montant TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.travel !== false && <th className="data-table__num">Dépl. HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {visible.pdf !== false && <th className="data-table__pdf">PDF</th>}
                  {isAdmin && visible.actions !== false && <th className="data-table__actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = invoiceStatutBadgeProps(inv.status)
                  return (
                    <tr key={inv.id}>
                      {visible.number !== false && (
                        <td>
                          <button type="button" className="link-inline invoice-number-btn" onClick={() => openEdit(inv)}>
                            <code className="code-badge">{inv.number}</code>
                          </button>
                        </td>
                      )}
                      {visible.client !== false && (
                        <td>
                          {inv.client?.name ? (
                            <Link to={`/clients/${inv.client_id}`} className="link-inline">
                              {inv.client.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visible.date !== false && <td>{formatAppDate(inv.invoice_date)}</td>}
                      {visible.ttc !== false && (
                        <td className="data-table__num">{formatMoney(Number(inv.amount_ttc))}</td>
                      )}
                      {visible.travel !== false && (
                        <td className="data-table__num">{formatMoney(Number(inv.travel_fee_ht ?? 0))}</td>
                      )}
                      {visible.status !== false && (
                        <td className="data-table__status">
                          <StatusBadge variant={st.variant} size="sm">
                            {st.label}
                          </StatusBadge>
                        </td>
                      )}
                      {visible.pdf !== false && (
                        <td className="data-table__pdf">
                          {isLab ? (
                            <QuotePdfButton onClick={() => pdfApi.generate('invoice', inv.id, inv.pdf_template_id)} />
                          ) : (
                            <QuotePdfButton
                              onClick={() => invoicesApi.openInvoicePdf(inv.id)}
                              label="Télécharger le PDF"
                            />
                          )}
                        </td>
                      )}
                      {isAdmin && visible.actions !== false && (
                        <td className="data-table__actions">
                          <TableRowActions
                            onEdit={() => openEdit(inv)}
                            onDelete={() => setDeleteTarget(inv)}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucune facture ne correspond aux filtres.</p>
        )}
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer la facture"
          message={
            <>
              Supprimer la facture <strong>{deleteTarget.number}</strong> ? Cette action est irréversible.
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMutation.isPending}
          error={deleteMutation.isError ? (deleteMutation.error as Error).message : null}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => {
            if (!deleteMutation.isPending) setDeleteTarget(null)
          }}
        />
      ) : null}

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
                <p className="text-muted" style={{ fontSize: '0.9rem' }}>
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
              <ExtrafieldsForm
                entityType="invoice"
                entityId={editInvoice.id}
                canEdit
                title="Champs configurés (extrafields)"
              />
            )}
          </>
        </Modal>
      )}

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </ModuleEntityShell>
  )
}
