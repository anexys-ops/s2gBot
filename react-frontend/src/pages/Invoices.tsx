import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  clientsApi,
  invoicesApi,
  type Invoice,
} from '../api/client'
import {
  InvoiceRowActionCells,
  InvoiceRowActionHeaders,
} from '../components/invoices/InvoiceListTableActions'
import StatusChangeModal from '../components/StatusChangeModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ClickableStatusBadge from '../components/ds/ClickableStatusBadge'
import StatusBadge, { bonCommandeStatutBadgeProps, invoiceStatutBadgeProps } from '../components/ds/StatusBadge'
import Toast, { toastErrorMessage, type ToastVariant } from '../components/Toast'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import TableRowActions from '../components/TableRowActions'
import DocumentPdfPickerModal from '../components/pdf/DocumentPdfPickerModal'
import { useAuth } from '../contexts/AuthContext'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { ListTableFootRow, ListTablePanelHeader } from '../components/ListTablePanel'
import { sumNumeric } from '../lib/listTableTotals'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'
import { invoiceEmailRecipient, invoiceWhatsAppPhone } from '../lib/invoiceEmailRecipient'
import {
  INVOICE_QUICK_FILTERS,
  invoiceReminderLabel,
  invoiceReminderTone,
  type InvoiceQuickFilter,
} from '../lib/invoiceReminder'
import { shouldIgnoreTableRowClick } from '../lib/tableRowInteraction'

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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [pdfTarget, setPdfTarget] = useState<Invoice | null>(null)
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null)
  const [reminderTarget, setReminderTarget] = useState<Invoice | null>(null)
  const [statusModalInvoice, setStatusModalInvoice] = useState<Invoice | null>(null)
  const [sendError, setSendError] = useState('')
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState<InvoiceQuickFilter>('')
  const [page, setPage] = useState(1)
  const { visible, toggle } = usePersistedColumnVisibility('invoices', {
    number: true,
    client: true,
    date: true,
    due: true,
    relance: true,
    ht: true,
    ttc: true,
    travel: false,
    status: true,
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

  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients', 'invoices-toolbar'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', debouncedSearch, statusFilter, clientFilter, quickFilter, page],
    queryFn: () =>
      invoicesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
        client_id: clientFilter ? Number(clientFilter) : undefined,
        quick_filter: quickFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => invoicesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setStatusModalInvoice(null)
    },
  })

  const sendEmailMutation = useMutation({
    mutationFn: ({
      id,
      email,
      name,
      pdf_template_id,
    }: {
      id: number
      email: string
      name: string
      pdf_template_id?: number
    }) => invoicesApi.sendEmail(id, { recipient_email: email, recipient_name: name, pdf_template_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setSendTarget(null)
      setSendError('')
      showToast('Facture envoyée par email.', 'success')
    },
    onError: (err) => {
      setSendError(toastErrorMessage(err, 'Échec de l’envoi email.'))
    },
  })

  const reminderMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => invoicesApi.sendReminder(id, { note }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setReminderTarget(null)
      showToast(res.message ?? 'Relance enregistrée.', 'success')
    },
    onError: (err) => {
      showToast(toastErrorMessage(err, 'Échec de la relance.'), 'error')
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
  const totals = useMemo(
    () => ({
      ht: sumNumeric(invoices, (inv) => inv.amount_ht),
      ttc: sumNumeric(invoices, (inv) => inv.amount_ttc),
      travel: sumNumeric(invoices, (inv) => inv.travel_fee_ht ?? 0),
    }),
    [invoices],
  )
  const lastPage = data?.last_page ?? 1
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const hasActiveFilters =
    searchInput.trim() !== '' || statusFilter !== '' || clientFilter !== '' || quickFilter !== ''

  const openEditor = useCallback(
    (inv: Invoice) => {
      navigate(`/factures/${inv.id}/editer`)
    },
    [navigate],
  )

  const openWhatsApp = useCallback(async (inv: Invoice) => {
    const phone = invoiceWhatsAppPhone(inv)
    if (!phone) {
      showToast('Aucun numéro WhatsApp ou téléphone client.', 'error')
      return
    }
    try {
      const { url } = await invoicesApi.getPdfLink(inv.id)
      const text = encodeURIComponent(
        `Bonjour, voici la facture ${inv.number} (${formatMoney(Number(inv.amount_ttc))} TTC) : ${url}`,
      )
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer')
    } catch (err) {
      showToast(toastErrorMessage(err, 'Impossible d’ouvrir WhatsApp.'), 'error')
    }
  }, [])

  const editFromQuery = searchParams.get('edit')
  useEffect(() => {
    if (!editFromQuery) return
    const id = Number(editFromQuery)
    if (!Number.isFinite(id) || id <= 0) return
    navigate(`/factures/${id}/editer`, { replace: true })
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('edit')
        return n
      },
      { replace: true },
    )
  }, [editFromQuery, navigate, setSearchParams])

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

      <div className="invoice-quick-filters" role="toolbar" aria-label="Filtres rapides factures">
        {INVOICE_QUICK_FILTERS.map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            className={`list-table-toolbar__chip invoice-quick-filters__btn${
              quickFilter === f.id ? ' invoice-quick-filters__btn--active' : ''
            }`}
            onClick={() => {
              setQuickFilter(f.id)
              setPage(1)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

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
          { id: 'due', label: 'Échéance' },
          { id: 'relance', label: 'Relance' },
          { id: 'ht', label: 'Montant HT' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
          { id: 'status', label: 'Statut' },
          ...(isLab ? [{ id: 'actions', label: 'Actions' }] : []),
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
              {quickFilter ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    {INVOICE_QUICK_FILTERS.find((f) => f.id === quickFilter)?.label ?? quickFilter}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setQuickFilter('')}
                    aria-label="Effacer le filtre rapide"
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
        <ListTablePanelHeader title="Factures" count={invoices.length} />
        {invoices.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.number !== false && <th className="data-table__code">Numéro</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.due !== false && <th>Échéance</th>}
                  {visible.relance !== false && <th>Relance</th>}
                  {visible.ht !== false && <th className="data-table__num">Montant HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.ttc !== false && <th className="data-table__num">Montant TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.travel !== false && <th className="data-table__num">Dépl. HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {isLab && visible.actions !== false && (
                    <>
                      <InvoiceRowActionHeaders />
                      {isAdmin ? <th className="data-table__actions">Suppr.</th> : null}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = invoiceStatutBadgeProps(inv.status)
                  const reminderTone = invoiceReminderTone(inv)
                  const reminderBadge = invoiceReminderLabel(inv)
                  const emailRecipient = invoiceEmailRecipient(inv)
                  const whatsApp = invoiceWhatsAppPhone(inv)
                  return (
                    <tr
                      key={inv.id}
                      className={`table-row-link${reminderTone === 'danger' ? ' invoice-row--overdue' : ''}`}
                      onClick={(e) => {
                        if (shouldIgnoreTableRowClick(e.target)) return
                        openEditor(inv)
                      }}
                    >
                      {visible.number !== false && (
                        <td className="data-table__code">
                          <Link
                            to={`/factures/${inv.id}/editer`}
                            className="link-inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <code className="code-badge">{inv.number}</code>
                          </Link>
                        </td>
                      )}
                      {visible.client !== false && (
                        <td>
                          {inv.client?.name ? (
                            <Link to={`/clients/${inv.client_id}/fiche`} className="link-inline" onClick={(e) => e.stopPropagation()}>
                              {inv.client.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visible.date !== false && <td>{formatAppDate(inv.invoice_date)}</td>}
                      {visible.due !== false && (
                        <td>
                          {inv.due_date ? (
                            <span className={`invoice-due-badge invoice-due-badge--${reminderTone ?? 'neutral'}`}>
                              {formatAppDate(inv.due_date)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visible.relance !== false && (
                        <td>
                          {inv.next_reminder_date ? (
                            <span className={`invoice-due-badge invoice-due-badge--${reminderTone ?? 'neutral'}`}>
                              {formatAppDate(inv.next_reminder_date)}
                            </span>
                          ) : reminderBadge ? (
                            <StatusBadge variant={reminderTone === 'danger' ? 'danger' : 'warning'} size="sm">
                              {reminderBadge}
                            </StatusBadge>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visible.ht !== false && (
                        <td className="data-table__num">
                          {formatMoney(Number(inv.amount_ht), inv.currency_code ?? inv.client?.currency_code)}
                        </td>
                      )}
                      {visible.ttc !== false && (
                        <td className="data-table__num">
                          {formatMoney(Number(inv.amount_ttc), inv.currency_code ?? inv.client?.currency_code)}
                        </td>
                      )}
                      {visible.travel !== false && (
                        <td className="data-table__num">{formatMoney(Number(inv.travel_fee_ht ?? 0))}</td>
                      )}
                      {visible.status !== false && (
                        <td className="data-table__status">
                          {isAdmin ? (
                            <ClickableStatusBadge
                              variant={st.variant}
                              size="sm"
                              ariaLabel={`Changer le statut de la facture ${inv.number}`}
                              onClick={() => setStatusModalInvoice(inv)}
                            >
                              {st.label}
                            </ClickableStatusBadge>
                          ) : (
                            <StatusBadge variant={st.variant} size="sm">
                              {st.label}
                            </StatusBadge>
                          )}
                        </td>
                      )}
                      {isLab && visible.actions !== false && (
                        <>
                          <InvoiceRowActionCells
                            invoiceNumber={inv.number}
                            status={inv.status}
                            canEmail={!!emailRecipient}
                            canWhatsApp={!!whatsApp}
                            onPdf={() => (isLab ? setPdfTarget(inv) : void invoicesApi.openInvoicePdf(inv.id))}
                            onEmail={emailRecipient ? () => setSendTarget(inv) : undefined}
                            onWhatsApp={whatsApp ? () => void openWhatsApp(inv) : undefined}
                            onReminder={() => setReminderTarget(inv)}
                            emailLoading={sendEmailMutation.isPending && sendTarget?.id === inv.id}
                          />
                          {isAdmin ? (
                            <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                              <TableRowActions onDelete={() => setDeleteTarget(inv)} />
                            </td>
                          ) : null}
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <ListTableFootRow
                columns={[
                  { id: 'number', kind: 'text' },
                  { id: 'client', kind: 'text' },
                  { id: 'date', kind: 'text' },
                  { id: 'due', kind: 'text' },
                  { id: 'relance', kind: 'text' },
                  { id: 'ht', kind: 'money' },
                  { id: 'ttc', kind: 'money' },
                  { id: 'travel', kind: 'money' },
                  { id: 'status', kind: 'text' },
                  ...(isLab ? [{ id: 'actions', kind: 'text' as const }] : []),
                ]}
                visible={visible}
                totals={totals}
              />
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

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}

      {statusModalInvoice ? (
        <StatusChangeModal
          title={`Statut — ${statusModalInvoice.number}`}
          initialValue={statusModalInvoice.status}
          options={statusOptions}
          isPending={statusMutation.isPending}
          error={statusMutation.isError ? (statusMutation.error as Error).message : null}
          onClose={() => setStatusModalInvoice(null)}
          onSave={(next) => statusMutation.mutate({ id: statusModalInvoice.id, status: next })}
        />
      ) : null}

      {sendTarget ? (
        <DocumentPdfPickerModal
          documentType="invoice"
          documentId={sendTarget.id}
          documentLabel={sendTarget.number}
          onClose={() => {
            if (!sendEmailMutation.isPending) {
              setSendTarget(null)
              setSendError('')
            }
          }}
          onEmail={async (templateId) => {
            const recipient = invoiceEmailRecipient(sendTarget)
            if (!recipient) {
              setSendError('Destinataire email introuvable.')
              return
            }
            await sendEmailMutation.mutateAsync({
              id: sendTarget.id,
              email: recipient.email,
              name: recipient.name,
              pdf_template_id: templateId,
            })
          }}
        />
      ) : null}

      {reminderTarget ? (
        <ConfirmDialog
          title={`Relancer — ${reminderTarget.number}`}
          message={
            <>
              Envoyer une relance pour la facture <strong>{reminderTarget.number}</strong> ?
              {reminderTarget.reminder_notes ? (
                <>
                  <br />
                  <br />
                  <span className="text-muted" style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
                    {reminderTarget.reminder_notes}
                  </span>
                </>
              ) : null}
            </>
          }
          confirmLabel="Relancer"
          loading={reminderMutation.isPending}
          error={reminderMutation.isError ? (reminderMutation.error as Error).message : null}
          onConfirm={() => {
            const note = window.prompt('Note de relance (optionnel) :') ?? ''
            reminderMutation.mutate({ id: reminderTarget.id, note: note || undefined })
          }}
          onCancel={() => {
            if (!reminderMutation.isPending) setReminderTarget(null)
          }}
        />
      ) : null}

      {sendError && !sendTarget ? <p className="error">{sendError}</p> : null}

      {pdfTarget ? (
        <DocumentPdfPickerModal
          documentType="invoice"
          documentId={pdfTarget.id}
          documentLabel={pdfTarget.number}
          onClose={() => setPdfTarget(null)}
        />
      ) : null}
    </ModuleEntityShell>
  )
}
