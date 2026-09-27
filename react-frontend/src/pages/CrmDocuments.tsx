import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { ListTableFootRow, ListTablePanelHeader } from '../components/ListTablePanel'
import { sumNumeric } from '../lib/listTableTotals'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import {
  commercialOfferingsApi,
  quotesApi,
  invoicesApi,
} from '../api/client'
import { IconEye, QuotePdfButton } from '../components/crm/QuoteListTableActions'
import DocumentPdfPickerModal from '../components/pdf/DocumentPdfPickerModal'
import TableIconHeader from '../components/TableIconHeader'
import type { PdfGenerateType } from '../lib/documentPdfTypes'
import { useAuth } from '../contexts/AuthContext'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'

const QUOTE_STATUS_LABELS: Record<string, string> = {
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

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  signed: 'Signée',
  sent: 'Envoyée',
  relanced: 'Relancée',
  paid: 'Encaissée',
}

type Tab = 'quotes' | 'invoices' | 'offerings'

const OFFERING_KIND_LABEL: Record<string, string> = { product: 'Produit', service: 'Prestation' }

export default function CrmDocuments() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const [tab, setTab] = useState<Tab>('quotes')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pdfTarget, setPdfTarget] = useState<{ type: PdfGenerateType; id: number; label: string } | null>(null)

  const quoteStatusOptions = Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const invoiceStatusOptions = Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }))

  const { visible, toggle } = usePersistedColumnVisibility('crm-documents', {
    client: true,
    number: true,
    date: true,
    status: true,
    ht: true,
    ttc: true,
    travel: true,
    pdf: true,
    crm: true,
    actions: true,
    off_code: true,
    off_name: true,
    off_kind: true,
    off_unit: true,
    off_price: true,
    off_active: true,
    off_actions: true,
  })

  useEffect(() => {
    setPage(1)
  }, [tab, debouncedSearch, statusFilter])

  const quotesQ = useQuery({
    queryKey: ['crm-documents', 'quotes', debouncedSearch, statusFilter, page],
    queryFn: () =>
      quotesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
      }),
    enabled: tab === 'quotes',
  })

  const invoicesQ = useQuery({
    queryKey: ['crm-documents', 'invoices', debouncedSearch, statusFilter, page],
    queryFn: () =>
      invoicesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
      }),
    enabled: tab === 'invoices',
  })

  const offeringsQ = useQuery({
    queryKey: ['crm-documents', 'offerings', debouncedSearch, page],
    queryFn: () => commercialOfferingsApi.list({ search: debouncedSearch.trim() || undefined, per_page: 30, page }),
    enabled: tab === 'offerings',
  })

  const loading =
    tab === 'quotes' ? quotesQ.isLoading : tab === 'invoices' ? invoicesQ.isLoading : offeringsQ.isLoading
  const error =
    tab === 'quotes' ? quotesQ.error : tab === 'invoices' ? invoicesQ.error : offeringsQ.error
  const data = tab === 'quotes' ? quotesQ.data : tab === 'invoices' ? invoicesQ.data : offeringsQ.data

  const quotes = tab === 'quotes' ? (quotesQ.data?.data ?? []) : []
  const invoices = tab === 'invoices' ? (invoicesQ.data?.data ?? []) : []
  const offerings = tab === 'offerings' ? (offeringsQ.data?.data ?? []) : []

  const quoteTotals = useMemo(
    () => ({
      ht: sumNumeric(quotes, (q) => q.amount_ht),
      ttc: sumNumeric(quotes, (q) => q.amount_ttc),
      travel: sumNumeric(quotes, (q) => q.travel_fee_ht ?? 0),
    }),
    [quotes],
  )
  const invoiceTotals = useMemo(
    () => ({
      ht: sumNumeric(invoices, (inv) => inv.amount_ht),
      ttc: sumNumeric(invoices, (inv) => inv.amount_ttc),
      travel: sumNumeric(invoices, (inv) => inv.travel_fee_ht ?? 0),
    }),
    [invoices],
  )
  const offeringTotals = useMemo(
    () => ({
      off_price: sumNumeric(offerings, (o) => o.sale_price_ht),
    }),
    [offerings],
  )

  if (loading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Commercial', to: '/crm' }, { label: 'Documents' }]}
        moduleBarLabel="Commercial — Documents"
        title="Documents commerciaux"
      >
        <p>Chargement…</p>
      </ModuleEntityShell>
    )
  }
  if (error) {
    return (
      <ModuleEntityShell
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Commercial', to: '/crm' }, { label: 'Documents' }]}
        moduleBarLabel="Commercial — Documents"
        title="Documents commerciaux"
      >
        <p className="error">{(error as Error).message}</p>
      </ModuleEntityShell>
    )
  }

  const tabTitle = tab === 'quotes' ? 'Devis' : tab === 'invoices' ? 'Factures' : 'Offres commerciales'
  const tabCount = tab === 'quotes' ? quotes.length : tab === 'invoices' ? invoices.length : offerings.length
  const lastPage = data?.last_page ?? 1
  const currentPage = data?.current_page ?? page

  const showClientCol = isLab && visible.client !== false
  const showDocEditCol = (isLab && tab === 'quotes') || (isAdmin && tab === 'invoices')
  const toolbarColumns =
    tab === 'offerings'
      ? [
          { id: 'off_code', label: 'Code' },
          { id: 'off_name', label: 'Libellé' },
          { id: 'off_kind', label: 'Type' },
          { id: 'off_unit', label: 'Unité' },
          { id: 'off_price', label: 'Prix vente HT' },
          { id: 'off_active', label: 'Actif' },
          { id: 'off_actions', label: 'Actions' },
        ]
      : [
          ...(isLab ? [{ id: 'client', label: 'Client' }] : []),
          { id: 'number', label: 'Numéro' },
          { id: 'date', label: 'Date' },
          { id: 'status', label: 'Statut' },
          { id: 'ht', label: 'Montant HT' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
          { id: 'pdf', label: 'PDF' },
          ...(isLab ? [{ id: 'crm', label: 'Fiche client' }] : []),
          ...(showDocEditCol ? [{ id: 'actions', label: 'Édition' }] : []),
        ]

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Commercial', to: '/crm' }, { label: 'Documents' }]}
      moduleBarLabel="Commercial — Documents"
      title="Documents commerciaux"
      subtitle="Devis, factures et offres (hors arbre PROLAB) — filtre, PDF, fiche client, édition."
    >
      <div className="crud-actions" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Link className="btn btn-sm btn-primary" to="/devis/nouveau">
          Nouveau devis
        </Link>
        <Link className="btn btn-sm btn-secondary" to="/invoices">
          Gestion des factures
        </Link>
        {isLab && (
          <Link className="btn btn-sm btn-secondary" to="/back-office/offres">
            Gérer les offres
          </Link>
        )}
      </div>

      <div className="crud-actions" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'quotes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('quotes')}
        >
          Devis
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('invoices')}
        >
          Factures
        </button>
        {isLab && (
          <button
            type="button"
            className={`btn btn-sm ${tab === 'offerings' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('offerings')}
          >
            Offres
          </button>
        )}
      </div>

      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={
          tab === 'offerings' ? 'Code, libellé, description…' : isLab ? 'N°, notes, nom client…' : 'N°, notes…'
        }
        statusValue={tab === 'offerings' ? '' : statusFilter}
        onStatusChange={tab === 'offerings' ? undefined : setStatusFilter}
        statusOptions={
          tab === 'offerings' ? undefined : tab === 'quotes' ? quoteStatusOptions : invoiceStatusOptions
        }
        columns={toolbarColumns}
        visibleColumns={visible}
        onToggleColumn={toggle}
      />

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title={tabTitle} count={tabCount} />
        {tab === 'quotes' && quotes.length > 0 && (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {showClientCol && <th>Client</th>}
                  {visible.number !== false && <th className="data-table__code">N°</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {visible.ht !== false && <th>HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.ttc !== false && <th>TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.travel !== false && <th>Dépl. HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.pdf !== false && (
                    <th className="data-table__pdf">
                      <TableIconHeader icon={<IconEye />} label="Voir le PDF" />
                    </th>
                  )}
                  {isLab && visible.crm !== false && <th>Fiche</th>}
                  {showDocEditCol && visible.actions !== false && <th>Édition</th>}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    {showClientCol && <td>{q.client?.name ?? '—'}</td>}
                    {visible.number !== false && <td className="data-table__code">{q.number}</td>}
                    {visible.date !== false && <td>{formatAppDate(q.quote_date)}</td>}
                    {visible.status !== false && <td>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</td>}
                    {visible.ht !== false && <td className="data-table__num">{formatMoney(Number(q.amount_ht))}</td>}
                    {visible.ttc !== false && <td className="data-table__num">{formatMoney(Number(q.amount_ttc))}</td>}
                    {visible.travel !== false && (
                      <td className="data-table__num">{formatMoney(Number(q.travel_fee_ht ?? 0))}</td>
                    )}
                    {visible.pdf !== false && (
                      <td className="data-table__pdf">
                        <QuotePdfButton onClick={() => setPdfTarget({ type: 'quote', id: q.id, label: q.number })} />
                      </td>
                    )}
                    {isLab && visible.crm !== false && (
                      <td>
                        <Link className="btn btn-secondary btn-sm" to={`/clients/${q.client_id}/commerce`}>
                          Vue commerciale
                        </Link>
                      </td>
                    )}
                    {showDocEditCol && visible.actions !== false && (
                      <td>
                        <Link className="btn btn-primary btn-sm" to={`/devis/${q.id}/editer`}>
                          Éditer
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <ListTableFootRow
                columns={[
                  ...(showClientCol ? [{ id: 'client', kind: 'text' as const }] : []),
                  { id: 'number', kind: 'text' },
                  { id: 'date', kind: 'text' },
                  { id: 'status', kind: 'text' },
                  { id: 'ht', kind: 'money' },
                  { id: 'ttc', kind: 'money' },
                  { id: 'travel', kind: 'money' },
                  { id: 'pdf', kind: 'text' },
                  ...(isLab ? [{ id: 'crm', kind: 'text' as const }] : []),
                  ...(showDocEditCol ? [{ id: 'actions', kind: 'text' as const }] : []),
                ]}
                visible={{ ...visible, client: showClientCol }}
                totals={quoteTotals}
              />
            </table>
          </div>
        )}

        {tab === 'offerings' && offerings.length > 0 && (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.off_code !== false && <th className="data-table__code">Code</th>}
                  {visible.off_name !== false && <th>Libellé</th>}
                  {visible.off_kind !== false && <th>Type</th>}
                  {visible.off_unit !== false && <th>Unité</th>}
                  {visible.off_price !== false && <th>Prix vente HT</th>}
                  {visible.off_active !== false && <th>Actif</th>}
                  {visible.off_actions !== false && <th>CRUD</th>}
                </tr>
              </thead>
              <tbody>
                {offerings.map((o) => (
                  <tr key={o.id}>
                    {visible.off_code !== false && <td className="data-table__code">{o.code || '—'}</td>}
                    {visible.off_name !== false && <td>{o.name}</td>}
                    {visible.off_kind !== false && <td>{OFFERING_KIND_LABEL[o.kind] ?? o.kind}</td>}
                    {visible.off_unit !== false && <td>{o.unit || '—'}</td>}
                    {visible.off_price !== false && (
                      <td className="data-table__num">{formatMoney(Number(o.sale_price_ht))}</td>
                    )}
                    {visible.off_active !== false && <td>{o.active ? 'Oui' : 'Non'}</td>}
                    {visible.off_actions !== false && (
                      <td>
                        <Link className="btn btn-primary btn-sm" to="/back-office/offres">
                          Gérer
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <ListTableFootRow
                columns={[
                  { id: 'off_code', kind: 'text' },
                  { id: 'off_name', kind: 'text' },
                  { id: 'off_kind', kind: 'text' },
                  { id: 'off_unit', kind: 'text' },
                  { id: 'off_price', kind: 'money' },
                  { id: 'off_active', kind: 'text' },
                  { id: 'off_actions', kind: 'text' },
                ]}
                visible={visible}
                totals={offeringTotals}
              />
            </table>
          </div>
        )}

        {tab === 'invoices' && invoices.length > 0 && (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {showClientCol && <th>Client</th>}
                  {visible.number !== false && <th className="data-table__code">N°</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {visible.ht !== false && <th>HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.ttc !== false && <th>TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.travel !== false && <th>Dépl. HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.pdf !== false && (
                    <th className="data-table__pdf">
                      <TableIconHeader icon={<IconEye />} label="Voir le PDF" />
                    </th>
                  )}
                  {isLab && visible.crm !== false && <th>Fiche</th>}
                  {showDocEditCol && visible.actions !== false && <th>Édition</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    {showClientCol && <td>{inv.client?.name ?? '—'}</td>}
                    {visible.number !== false && <td className="data-table__code">{inv.number}</td>}
                    {visible.date !== false && <td>{formatAppDate(inv.invoice_date)}</td>}
                    {visible.status !== false && <td>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</td>}
                    {visible.ht !== false && <td className="data-table__num">{formatMoney(Number(inv.amount_ht))}</td>}
                    {visible.ttc !== false && <td className="data-table__num">{formatMoney(Number(inv.amount_ttc))}</td>}
                    {visible.travel !== false && (
                      <td className="data-table__num">{formatMoney(Number(inv.travel_fee_ht ?? 0))}</td>
                    )}
                    {visible.pdf !== false && (
                      <td className="data-table__pdf">
                        <QuotePdfButton onClick={() => setPdfTarget({ type: 'invoice', id: inv.id, label: inv.number })} />
                      </td>
                    )}
                    {isLab && visible.crm !== false && (
                      <td>
                        <Link className="btn btn-secondary btn-sm" to={`/clients/${inv.client_id}/commerce`}>
                          Vue commerciale
                        </Link>
                      </td>
                    )}
                    {showDocEditCol && visible.actions !== false && (
                      <td>
                        <Link className="btn btn-primary btn-sm" to={`/invoices?edit=${inv.id}`}>
                          Modifier
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <ListTableFootRow
                columns={[
                  ...(showClientCol ? [{ id: 'client', kind: 'text' as const }] : []),
                  { id: 'number', kind: 'text' },
                  { id: 'date', kind: 'text' },
                  { id: 'status', kind: 'text' },
                  { id: 'ht', kind: 'money' },
                  { id: 'ttc', kind: 'money' },
                  { id: 'travel', kind: 'money' },
                  { id: 'pdf', kind: 'text' },
                  ...(isLab ? [{ id: 'crm', kind: 'text' as const }] : []),
                  ...(showDocEditCol ? [{ id: 'actions', kind: 'text' as const }] : []),
                ]}
                visible={{ ...visible, client: showClientCol }}
                totals={invoiceTotals}
              />
            </table>
          </div>
        )}

        {tab === 'quotes' && !quotes.length && <p className="dossier-tab-empty">Aucun devis.</p>}
        {tab === 'invoices' && !invoices.length && <p className="dossier-tab-empty">Aucune facture.</p>}
        {tab === 'offerings' && !offerings.length && <p className="dossier-tab-empty">Aucune offre commerciale.</p>}
      </div>

      <PaginationBar page={currentPage} lastPage={lastPage} onPage={setPage} />

      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
        <Link to="/clients">Gérer les clients</Link>
        {' · '}
        <Link to="/devis">Édition des devis</Link>
        {' · '}
        <Link to="/invoices">Édition des factures</Link>
        {isLab && (
          <>
            {' · '}
            <Link to="/back-office/offres">Offres commerciales (prix, TVA, stock)</Link>
          </>
        )}
      </p>

      {pdfTarget ? (
        <DocumentPdfPickerModal
          documentType={pdfTarget.type}
          documentId={pdfTarget.id}
          documentLabel={pdfTarget.label}
          onClose={() => setPdfTarget(null)}
        />
      ) : null}
    </ModuleEntityShell>
  )
}
