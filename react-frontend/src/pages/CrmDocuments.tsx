import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { invoicesApi, pdfApi, quotesApi, type Invoice, type Quote } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import { formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'

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

type Tab = 'quotes' | 'invoices'

export default function CrmDocuments() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [tab, setTab] = useState<Tab>('quotes')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const quoteStatusOptions = Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const invoiceStatusOptions = Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }))

  const { visible, toggle } = usePersistedColumnVisibility('crm-documents', {
    client: true,
    number: true,
    date: true,
    status: true,
    ttc: true,
    pdf: true,
    crm: true,
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

  const loading = tab === 'quotes' ? quotesQ.isLoading : invoicesQ.isLoading
  const error = tab === 'quotes' ? quotesQ.error : invoicesQ.error
  const data = tab === 'quotes' ? quotesQ.data : invoicesQ.data

  if (loading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'CRM', to: '/crm' }, { label: 'Documents' }]}
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
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'CRM', to: '/crm' }, { label: 'Documents' }]}
        moduleBarLabel="Commercial — Documents"
        title="Documents commerciaux"
      >
        <p className="error">{(error as Error).message}</p>
      </ModuleEntityShell>
    )
  }

  const quotes = data && 'data' in data ? (data.data as Quote[]) : []
  const invoices = data && 'data' in data ? (data.data as Invoice[]) : []
  const lastPage = data?.last_page ?? 1
  const currentPage = data?.current_page ?? page

  const showClientCol = isLab && visible.client !== false

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'CRM', to: '/crm' }, { label: 'Documents' }]}
      moduleBarLabel="Commercial — Documents"
      title="Documents commerciaux"
      subtitle="Registre devis & factures — filtres de statut, PDF, lien vers la fiche client (onglet Commerce)"
    >
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
      </div>

      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={isLab ? 'N°, notes, nom client…' : 'N°, notes…'}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={tab === 'quotes' ? quoteStatusOptions : invoiceStatusOptions}
        columns={[
          ...(isLab ? [{ id: 'client', label: 'Client' }] : []),
          { id: 'number', label: 'Numéro' },
          { id: 'date', label: 'Date' },
          { id: 'status', label: 'Statut' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'pdf', label: 'PDF' },
          ...(isLab ? [{ id: 'crm', label: 'Fiche CRM' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
      />

      <div className="card">
        {tab === 'quotes' && (
          <table>
            <thead>
              <tr>
                {showClientCol && <th>Client</th>}
                {visible.number !== false && <th>N°</th>}
                {visible.date !== false && <th>Date</th>}
                {visible.status !== false && <th>Statut</th>}
                {visible.ttc !== false && <th>TTC ({MONEY_UNIT_LABEL})</th>}
                {visible.pdf !== false && <th>PDF</th>}
                {isLab && visible.crm !== false && <th>Fiche</th>}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  {showClientCol && <td>{q.client?.name ?? '—'}</td>}
                  {visible.number !== false && <td>{q.number}</td>}
                  {visible.date !== false && <td>{new Date(q.quote_date).toLocaleDateString('fr-FR')}</td>}
                  {visible.status !== false && <td>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</td>}
                  {visible.ttc !== false && <td>{formatMoney(Number(q.amount_ttc))}</td>}
                  {visible.pdf !== false && (
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
                  {isLab && visible.crm !== false && (
                    <td>
                      <Link className="btn btn-secondary btn-sm" to={`/clients/${q.client_id}/commerce`}>
                        Vue commerciale
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'invoices' && (
          <table>
            <thead>
              <tr>
                {showClientCol && <th>Client</th>}
                {visible.number !== false && <th>N°</th>}
                {visible.date !== false && <th>Date</th>}
                {visible.status !== false && <th>Statut</th>}
                {visible.ttc !== false && <th>TTC ({MONEY_UNIT_LABEL})</th>}
                {visible.pdf !== false && <th>PDF</th>}
                {isLab && visible.crm !== false && <th>Fiche</th>}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  {showClientCol && <td>{inv.client?.name ?? '—'}</td>}
                  {visible.number !== false && <td>{inv.number}</td>}
                  {visible.date !== false && <td>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</td>}
                  {visible.status !== false && <td>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</td>}
                  {visible.ttc !== false && <td>{formatMoney(Number(inv.amount_ttc))}</td>}
                  {visible.pdf !== false && (
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
                  {isLab && visible.crm !== false && (
                    <td>
                      <Link className="btn btn-secondary btn-sm" to={`/clients/${inv.client_id}/commerce`}>
                        Vue commerciale
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'quotes' && !quotes.length && <p style={{ padding: '1rem' }}>Aucun devis.</p>}
        {tab === 'invoices' && !invoices.length && <p style={{ padding: '1rem' }}>Aucune facture.</p>}
      </div>

      <PaginationBar page={currentPage} lastPage={lastPage} onPage={setPage} />

      <p style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
        <Link to="/clients">Gérer les clients</Link>
        {' · '}
        <Link to="/devis">Édition des devis</Link>
        {' · '}
        <Link to="/invoices">Édition des factures</Link>
      </p>
    </ModuleEntityShell>
  )
}
