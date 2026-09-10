import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { quotesApi, type EntityMetaPayload, type Quote } from '../api/client'
import { QuotePdfButton, QuoteRowActionCells, QuoteRowActionHeaders } from '../components/crm/QuoteListTableActions'
import DocumentPdfPickerModal from '../components/pdf/DocumentPdfPickerModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ClickableStatusBadge from '../components/ds/ClickableStatusBadge'
import StatusBadge, { quoteStatutBadgeProps } from '../components/ds/StatusBadge'
import EntityMetaCard from '../components/module/EntityMetaCard'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import StatusChangeModal from '../components/StatusChangeModal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { ListTableFootRow, ListTablePanelHeader } from '../components/ListTablePanel'
import { sumNumeric } from '../lib/listTableTotals'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'
import { quoteEmailRecipient } from '../lib/quoteEmailRecipient'
import { shouldIgnoreTableRowClick } from '../lib/tableRowInteraction'

function quoteBonCommandes(q: Quote): NonNullable<Quote['bons_commande']> {
  const list = q.bons_commande ?? q.bonsCommande
  if (Array.isArray(list) && list.length > 0) return list
  const single = q.bon_commande ?? q.bonCommande
  return single ? [single] : []
}

function chainCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function quotePricingMode(q: Quote): { label: string; variant: 'warning' | 'info' } {
  return q.meta?.mode_devis === 'forfait'
    ? { label: 'Forfait', variant: 'warning' }
    : { label: 'Détaillé', variant: 'info' }
}

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

export default function Devis() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [metaModalQuote, setMetaModalQuote] = useState<{ id: number; number: string; meta: unknown } | null>(null)
  const [statusModalQuote, setStatusModalQuote] = useState<{ id: number; number: string; status: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; number: string } | null>(null)
  const [sendTarget, setSendTarget] = useState<Quote | null>(null)
  const [pdfTarget, setPdfTarget] = useState<Quote | null>(null)
  const [sendError, setSendError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const { visible, toggle } = usePersistedColumnVisibility('quotes', {
    number: true,
    client: true,
    date: true,
    ht: true,
    ttc: true,
    travel: true,
    status: true,
    bc: true,
    bl: true,
    invoices: true,
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
    placeholderData: keepPreviousData,
  })

  const quoteMetaMut = useMutation({
    mutationFn: ({ id, meta }: { id: number; meta: EntityMetaPayload }) => quotesApi.update(id, { meta }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', v.id] })
      setMetaModalQuote(null)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => quotesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setStatusModalQuote(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setDeleteTarget(null)
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
    }) => quotesApi.sendEmail(id, { recipient_email: email, recipient_name: name, pdf_template_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setSendTarget(null)
      setSendError('')
    },
    onError: (err: Error) => setSendError(err.message),
  })

  const quotes = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const totals = useMemo(
    () => ({
      ht: sumNumeric(quotes, (q) => q.amount_ht),
      ttc: sumNumeric(quotes, (q) => q.amount_ttc),
      travel: sumNumeric(quotes, (q) => q.travel_fee_ht ?? 0),
    }),
    [quotes],
  )
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const hasActiveFilters = searchInput.trim() !== '' || statusFilter !== ''

  if (isLoading && !data) {
    return (
      <ModuleEntityShell
        shellClassName="module-shell--crm"
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Devis' },
        ]}
        moduleBarLabel="Commercial — Devis"
        title="Devis"
        subtitle="Chargement…"
      >
        <p className="text-muted">Chargement des devis…</p>
      </ModuleEntityShell>
    )
  }
  if (error) {
    return (
      <ModuleEntityShell
        shellClassName="module-shell--crm"
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Devis' },
        ]}
        moduleBarLabel="Commercial — Devis"
        title="Devis"
      >
        <p className="error">Erreur : {String(error)}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Devis' },
      ]}
      moduleBarLabel="Commercial — Devis"
      title="Devis"
      subtitle="Propositions commerciales : brouillons, signature, suivi des montants TTC et frais de déplacement."
      actions={
        isLab ? (
          <>
            <Link to="/devis/nouveau" className="btn btn-primary btn-sm">
              Nouveau devis
            </Link>
            <Link to="/back-office/offres" className="btn btn-secondary btn-sm">
              Offres (catalogue)
            </Link>
          </>
        ) : null
      }
    >
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
          { id: 'ht', label: 'Montant HT' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
          { id: 'mode', label: 'Mode' },
          { id: 'status', label: 'Statut' },
          ...(isLab
            ? [
                { id: 'bc', label: 'BC' },
                { id: 'bl', label: 'BL' },
                { id: 'invoices', label: 'Factures' },
              ]
            : []),
          ...(isLab ? [{ id: 'pdf', label: 'PDF' }] : []),
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
                  <span className="list-table-toolbar__chip-text">
                    {STATUS_LABELS[statusFilter] ?? statusFilter}
                  </span>
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
            </>
          ) : null
        }
      />

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title="Devis" count={quotes.length} />
        {quotes.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.number !== false && <th className="data-table__code">Numéro</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.ht !== false && <th>Montant HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.ttc !== false && <th>Montant TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.travel !== false && <th>Dépl. HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.mode !== false && <th>Mode</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {isLab && visible.bc !== false && <th className="data-table__code">BC</th>}
                  {isLab && visible.bl !== false && <th className="data-table__num">BL</th>}
                  {isLab && visible.invoices !== false && <th className="data-table__num">Factures</th>}
                  {isLab && visible.pdf !== false && <th className="data-table__pdf">PDF</th>}
                  {isLab && visible.actions !== false && <QuoteRowActionHeaders />}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const st = quoteStatutBadgeProps(q.status)
                  const mode = quotePricingMode(q)
                  const bcs = quoteBonCommandes(q)
                  const blCount = bcs.reduce((sum, bc) => sum + chainCount(bc.bons_livraison_count), 0)
                  const invoiceCount = bcs.reduce((sum, bc) => sum + chainCount(bc.invoices_count), 0)
                  return (
                    <tr
                      key={q.id}
                      className="table-row-link"
                      onClick={(e) => {
                        if (shouldIgnoreTableRowClick(e.target)) return
                        navigate(`/devis/${q.id}/editer`)
                      }}
                    >
                      {visible.number !== false && (
                        <td className="data-table__code">
                          <Link to={`/devis/${q.id}/editer`} className="link-inline" onClick={(e) => e.stopPropagation()}>
                            <code className="code-badge">{q.number}</code>
                          </Link>
                        </td>
                      )}
                      {visible.client !== false && <td>{q.client?.name ?? '—'}</td>}
                      {visible.date !== false && <td>{formatAppDate(q.quote_date)}</td>}
                      {visible.ht !== false && <td className="data-table__num">{formatMoney(Number(q.amount_ht))}</td>}
                      {visible.ttc !== false && <td className="data-table__num">{formatMoney(Number(q.amount_ttc))}</td>}
                      {visible.travel !== false && (
                        <td className="data-table__num">{formatMoney(Number(q.travel_fee_ht ?? 0))}</td>
                      )}
                      {visible.mode !== false && (
                        <td className="data-table__status">
                          <StatusBadge variant={mode.variant} size="sm">
                            {mode.label}
                          </StatusBadge>
                        </td>
                      )}
                      {visible.status !== false && (
                        <td className="data-table__status">
                          {isLab ? (
                            <ClickableStatusBadge
                              variant={st.variant}
                              size="sm"
                              ariaLabel={`Changer le statut du devis ${q.number}`}
                              onClick={() => setStatusModalQuote({ id: q.id, number: q.number, status: q.status })}
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
                      {isLab && visible.bc !== false && (
                        <td className="data-table__code">
                          {bcs.length > 0 ? (
                            <span className="bc-chain-links">
                              {bcs.map((bc, index) => (
                                <span key={bc.id}>
                                  {index > 0 ? ', ' : null}
                                  <Link to={`/bons-commande/${bc.id}`} className="link-inline">
                                    <code className="code-badge">{bc.numero}</code>
                                  </Link>
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      )}
                      {isLab && visible.bl !== false && (
                        <td className="data-table__num">
                          {bcs.length > 0 ? (
                            blCount
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      )}
                      {isLab && visible.invoices !== false && (
                        <td className="data-table__num">
                          {bcs.length > 0 ? (
                            invoiceCount
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      )}
                      {isLab && visible.pdf !== false && (
                        <td className="data-table__pdf">
                          <QuotePdfButton onClick={() => setPdfTarget(q)} />
                        </td>
                      )}
                      {isLab && visible.actions !== false && (
                        <QuoteRowActionCells
                          quoteNumber={q.number}
                          status={q.status}
                          isAdmin={isAdmin}
                          onMeta={() => setMetaModalQuote({ id: q.id, number: q.number, meta: q.meta })}
                          onDelete={() => setDeleteTarget({ id: q.id, number: q.number })}
                          onSendEmail={
                            q.status === 'draft'
                              ? () => {
                                  setSendError('')
                                  setSendTarget(q)
                                }
                              : undefined
                          }
                          sendEmailLoading={sendEmailMutation.isPending && sendTarget?.id === q.id}
                        />
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
                  { id: 'ht', kind: 'money' },
                  { id: 'ttc', kind: 'money' },
                  { id: 'travel', kind: 'money' },
                  { id: 'mode', kind: 'text' },
                  { id: 'status', kind: 'text' },
                  ...(isLab
                    ? [
                        { id: 'bc', kind: 'text' as const },
                        { id: 'bl', kind: 'text' as const },
                        { id: 'invoices', kind: 'text' as const },
                      ]
                    : []),
                  ...(isLab ? [{ id: 'pdf', kind: 'text' as const }] : []),
                  ...(isLab ? [{ id: 'actions', kind: 'text' as const, span: 3 }] : []),
                ]}
                visible={visible}
                totals={totals}
              />
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun devis ne correspond aux filtres.</p>
        )}
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

      {statusModalQuote !== null && (
        <StatusChangeModal
          title={`Statut — ${statusModalQuote.number}`}
          initialValue={statusModalQuote.status}
          options={statusOptions}
          isPending={statusMutation.isPending}
          error={statusMutation.isError ? (statusMutation.error as Error).message : null}
          onClose={() => setStatusModalQuote(null)}
          onSave={(status) => statusMutation.mutate({ id: statusModalQuote.id, status })}
        />
      )}

      {metaModalQuote && (
        <Modal title={`Métadonnées — ${metaModalQuote.number}`} onClose={() => setMetaModalQuote(null)}>
          <EntityMetaCard
            meta={metaModalQuote.meta}
            editable
            onSave={(meta) => quoteMetaMut.mutateAsync({ id: metaModalQuote.id, meta })}
            isSaving={quoteMetaMut.isPending}
            saveError={quoteMetaMut.isError ? (quoteMetaMut.error as Error).message : null}
          />
        </Modal>
      )}

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer le devis"
          message={
            <>
              Supprimer définitivement le devis <strong>{deleteTarget.number}</strong> ?
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

      {pdfTarget ? (
        <DocumentPdfPickerModal
          documentType="quote"
          documentId={pdfTarget.id}
          documentLabel={pdfTarget.number}
          onClose={() => setPdfTarget(null)}
        />
      ) : null}

      {sendTarget ? (
        <DocumentPdfPickerModal
          documentType="quote"
          documentId={sendTarget.id}
          documentLabel={sendTarget.number}
          onClose={() => {
            if (!sendEmailMutation.isPending) {
              setSendTarget(null)
              setSendError('')
            }
          }}
          onEmail={async (templateId) => {
            const recipient = quoteEmailRecipient(sendTarget)
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

      {sendError && !sendTarget && !pdfTarget ? <p className="error">{sendError}</p> : null}
    </ModuleEntityShell>
  )
}
