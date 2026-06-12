import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { pdfApi, quotesApi, type EntityMetaPayload, type Quote } from '../api/client'
import { QuotePdfButton, QuoteRowActionCells, QuoteRowActionHeaders } from '../components/crm/QuoteListTableActions'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge, { quoteStatutBadgeProps } from '../components/ds/StatusBadge'
import EntityMetaCard from '../components/module/EntityMetaCard'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'
import { quoteEmailRecipient } from '../lib/quoteEmailRecipient'

function quoteBonCommande(q: Quote) {
  return q.bon_commande ?? q.bonCommande ?? null
}

function chainCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
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
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [statusModalId, setStatusModalId] = useState<number | null>(null)
  const [metaModalQuote, setMetaModalQuote] = useState<{ id: number; number: string; meta: unknown } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; number: string } | null>(null)
  const [sendTarget, setSendTarget] = useState<Quote | null>(null)
  const [sendError, setSendError] = useState('')
  const [statusValue, setStatusValue] = useState('')
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
      setStatusModalId(null)
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
    mutationFn: ({ id, email, name }: { id: number; email: string; name: string }) =>
      quotesApi.sendEmail(id, { recipient_email: email, recipient_name: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setSendTarget(null)
      setSendError('')
    },
    onError: (err: Error) => setSendError(err.message),
  })

  const quotes = data?.data ?? []
  const lastPage = data?.last_page ?? 1
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
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
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
        {quotes.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.number !== false && <th>Numéro</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.ttc !== false && <th>Montant TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.travel !== false && <th>Dépl. HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {isLab && visible.bc !== false && <th>BC</th>}
                  {isLab && visible.bl !== false && <th className="data-table__num">BL</th>}
                  {isLab && visible.invoices !== false && <th className="data-table__num">Factures</th>}
                  {isLab && visible.pdf !== false && <th className="data-table__pdf">PDF</th>}
                  {isLab && visible.actions !== false && <QuoteRowActionHeaders />}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const st = quoteStatutBadgeProps(q.status)
                  const bc = quoteBonCommande(q)
                  const blCount = chainCount(bc?.bons_livraison_count)
                  const invoiceCount = chainCount(bc?.invoices_count)
                  return (
                    <tr key={q.id}>
                      {visible.number !== false && (
                        <td>
                          <Link to={`/devis/${q.id}/editer`} className="link-inline">
                            <code className="code-badge">{q.number}</code>
                          </Link>
                        </td>
                      )}
                      {visible.client !== false && <td>{q.client?.name ?? '—'}</td>}
                      {visible.date !== false && <td>{formatAppDate(q.quote_date)}</td>}
                      {visible.ttc !== false && <td>{formatMoney(Number(q.amount_ttc))}</td>}
                      {visible.travel !== false && <td>{formatMoney(Number(q.travel_fee_ht ?? 0))}</td>}
                      {visible.status !== false && (
                        <td className="data-table__status">
                          <StatusBadge variant={st.variant} size="sm">
                            {st.label}
                          </StatusBadge>
                        </td>
                      )}
                      {isLab && visible.bc !== false && (
                        <td>
                          {bc ? (
                            <Link to={`/bons-commande/${bc.id}`} className="link-inline">
                              <code className="code-badge">{bc.numero}</code>
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      )}
                      {isLab && visible.bl !== false && (
                        <td className="data-table__num">
                          {bc && blCount > 0 ? (
                            bc.dossier_id ? (
                              <Link to={`/dossiers/${bc.dossier_id}/bc-bl`} className="link-inline">
                                {blCount}
                              </Link>
                            ) : (
                              blCount
                            )
                          ) : (
                            <span className="text-muted">{bc ? '0' : '—'}</span>
                          )}
                        </td>
                      )}
                      {isLab && visible.invoices !== false && (
                        <td className="data-table__num">
                          {bc && invoiceCount > 0 ? (
                            <Link to="/factures" className="link-inline">
                              {invoiceCount}
                            </Link>
                          ) : (
                            <span className="text-muted">{bc ? '0' : '—'}</span>
                          )}
                        </td>
                      )}
                      {isLab && visible.pdf !== false && (
                        <td className="data-table__pdf">
                          <QuotePdfButton
                            onClick={() => pdfApi.generate('quote', q.id, q.pdf_template_id)}
                          />
                        </td>
                      )}
                      {isLab && visible.actions !== false && (
                        <QuoteRowActionCells
                          quoteId={q.id}
                          quoteNumber={q.number}
                          status={q.status}
                          isAdmin={isAdmin}
                          onStatus={() => {
                            setStatusModalId(q.id)
                            setStatusValue(q.status)
                          }}
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
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun devis ne correspond aux filtres.</p>
        )}
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

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

      {sendTarget && (
        <Modal
          title={`Envoyer le devis ${sendTarget.number}`}
          onClose={() => {
            if (!sendEmailMutation.isPending) {
              setSendTarget(null)
              setSendError('')
            }
          }}
        >
          {(() => {
            const recipient = quoteEmailRecipient(sendTarget)
            if (!recipient) {
              return (
                <>
                  <p className="text-muted" style={{ marginTop: 0 }}>
                    Aucun email trouvé pour ce devis. Ajoutez un contact avec email sur la fiche client ou renseignez
                    l&apos;email du client, puis réessayez.
                  </p>
                  <div className="crud-actions">
                    <Link to={`/devis/${sendTarget.id}/editer`} className="btn btn-primary">
                      Ouvrir le devis
                    </Link>
                    <button type="button" className="btn btn-secondary" onClick={() => setSendTarget(null)}>
                      Fermer
                    </button>
                  </div>
                </>
              )
            }
            return (
              <>
                <p style={{ marginTop: 0 }}>
                  Envoyer le devis <strong>{sendTarget.number}</strong> à{' '}
                  <strong>{recipient.name}</strong> — <a href={`mailto:${recipient.email}`}>{recipient.email}</a> ?
                </p>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>
                  Le PDF du devis sera joint à l&apos;email. Le statut passera à <strong>Envoyé</strong>.
                </p>
                <div className="crud-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={sendEmailMutation.isPending}
                    onClick={() =>
                      sendEmailMutation.mutate({
                        id: sendTarget.id,
                        email: recipient.email,
                        name: recipient.name,
                      })
                    }
                  >
                    {sendEmailMutation.isPending ? 'Envoi…' : 'Envoyer par email'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={sendEmailMutation.isPending}
                    onClick={() => setSendTarget(null)}
                  >
                    Annuler
                  </button>
                </div>
                {sendError ? <p className="error">{sendError}</p> : null}
              </>
            )
          })()}
        </Modal>
      )}
    </ModuleEntityShell>
  )
}
