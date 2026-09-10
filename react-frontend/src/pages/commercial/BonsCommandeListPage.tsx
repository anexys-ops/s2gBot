import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  bonsCommandeApi,
  devisV1Api,
  quotesApi,
  type BonCommande,
  type EntityMetaPayload,
} from '../../api/client'
import {
  BonCommandeRowActionCells,
  BonCommandeRowActionHeaders,
} from '../../components/crm/BonCommandeListTableActions'
import { QuotePdfButton } from '../../components/crm/QuoteListTableActions'
import ConfirmDialog from '../../components/ConfirmDialog'
import ClickableStatusBadge from '../../components/ds/ClickableStatusBadge'
import StatusBadge, { bonCommandeStatutBadgeProps, quoteStatutBadgeProps } from '../../components/ds/StatusBadge'
import StatusChangeModal from '../../components/StatusChangeModal'
import DocumentPdfPickerModal from '../../components/pdf/DocumentPdfPickerModal'
import ListTableToolbar from '../../components/ListTableToolbar'
import { ListTableFootRow, ListTablePanelHeader } from '../../components/ListTablePanel'
import Modal from '../../components/Modal'
import EntityMetaCard from '../../components/module/EntityMetaCard'
import { sumNumeric } from '../../lib/listTableTotals'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'
import { commercialDocumentCapabilities } from '../../lib/commercialDocumentActionConfig'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import { shouldIgnoreTableRowClick } from '../../lib/tableRowInteraction'

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  livre: 'Livré',
  annule: 'Annulé',
}

const statusOptions = Object.entries(STATUT_LABELS).map(([value, label]) => ({ value, label }))

function chainCount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function bcHasBonLivraison(bc: BonCommande): boolean {
  if (chainCount(bc.bons_livraison_count) > 0) return true
  return Array.isArray(bc.bons_livraison) && bc.bons_livraison.length > 0
}

function BonCommandeCreateFromDevisPanel() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [quoteId, setQuoteId] = useState('')
  const [quoteSearchInput, setQuoteSearchInput] = useState('')
  const debouncedQuoteSearch = useDebouncedValue(quoteSearchInput, 250)

  const { data: eligiblePage, isLoading, isError, error } = useQuery({
    queryKey: ['quotes', 'eligible-bc', debouncedQuoteSearch],
    queryFn: () =>
      quotesApi.listEligibleForBc({
        search: debouncedQuoteSearch.trim() || undefined,
      }),
  })

  const eligibleQuotes = eligiblePage?.data ?? []
  const hasQuoteSearch = debouncedQuoteSearch.trim() !== ''

  const selectedQuote = useMemo(
    () => eligibleQuotes.find((q) => String(q.id) === quoteId),
    [eligibleQuotes, quoteId],
  )

  const createMut = useMutation({
    mutationFn: (id: number) => devisV1Api.transformerBc(id),
    onSuccess: (bc) => {
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      void qc.invalidateQueries({ queryKey: ['quotes', 'eligible-bc'] })
      setQuoteId('')
      if (bc?.id) navigate(`/bons-commande/${bc.id}`)
    },
  })

  const handleCreate = () => {
    const id = Number(quoteId)
    if (!id) return
    createMut.mutate(id)
  }

  return (
    <section className="card bc-from-devis-panel" aria-labelledby="bc-from-devis-title">
      <header className="bc-from-devis-panel__header">
        <h2 id="bc-from-devis-title" className="bc-from-devis-panel__title">
          Créer depuis un devis
        </h2>
        <p className="bc-from-devis-panel__intro text-muted">
          Générez un bon de commande (BCC) à partir d&apos;un devis <strong>signé</strong> ou{' '}
          <strong>accepté</strong>, rattaché à un dossier. Vous pouvez créer plusieurs BC pour le même devis.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted bc-from-devis-panel__status">Chargement des devis éligibles…</p>
      ) : isError ? (
        <p className="error bc-from-devis-panel__status">{(error as Error).message}</p>
      ) : eligibleQuotes.length === 0 && !hasQuoteSearch ? (
        <div className="bc-from-devis-panel__empty dossier-tab-empty">
          <p>Aucun devis éligible pour le moment.</p>
          <ul className="bc-from-devis-panel__criteria">
            <li>Statut : signé ou accepté</li>
            <li>Rattaché à un dossier chantier</li>
            <li>Plusieurs BC possibles sur le même devis accepté</li>
          </ul>
          <p className="bc-from-devis-panel__empty-actions">
            <Link to="/devis" className="btn btn-secondary btn-sm">
              Voir les devis
            </Link>
            <Link to="/dossiers" className="btn btn-secondary btn-sm">
              Voir les dossiers
            </Link>
          </p>
        </div>
      ) : (
        <div className="bc-from-devis-panel__body">
          <div className="bc-from-devis-panel__form">
            <label className="form-group bc-from-devis-panel__field">
              <span className="bc-from-devis-panel__label">Rechercher un devis</span>
              <input
                type="search"
                value={quoteSearchInput}
                onChange={(e) => {
                  setQuoteSearchInput(e.target.value)
                  setQuoteId('')
                  createMut.reset()
                }}
                placeholder="N° devis, client, référence ou titre dossier…"
                autoComplete="off"
              />
            </label>

            <div className="invoice-orders-picker__list" role="listbox" aria-label="Devis éligibles">
              {eligibleQuotes.length === 0 ? (
                <p className="invoice-orders-picker__empty">
                  {hasQuoteSearch
                    ? 'Aucun devis éligible ne correspond à la recherche.'
                    : 'Aucun devis éligible pour le moment.'}
                </p>
              ) : (
                eligibleQuotes.map((quote) => {
                  const selected = String(quote.id) === quoteId
                  const st = quoteStatutBadgeProps(quote.status)
                  const bcCount = (quote.bons_commande ?? quote.bonsCommande)?.length ?? 0
                  return (
                    <button
                      key={quote.id}
                      type="button"
                      className={`invoice-orders-picker__option${selected ? ' invoice-orders-picker__option--selected' : ''}`}
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setQuoteId(selected ? '' : String(quote.id))
                        createMut.reset()
                      }}
                    >
                      <span className="invoice-orders-picker__checkbox" aria-hidden="true">
                        {selected ? '✓' : ''}
                      </span>
                      <span>
                        <strong>{quote.number}</strong> — {quote.client?.name ?? `Client #${quote.client_id}`}
                        {quote.dossier ? (
                          <span className="invoice-orders-picker__status">
                            {' '}
                            ({quote.dossier.reference ?? `#${quote.dossier_id}`})
                          </span>
                        ) : null}
                        <span className="invoice-orders-picker__status">
                          {' '}
                          — {st.label} — {formatMoney(Number(quote.amount_ttc))} TTC
                          {bcCount > 0 ? ` — ${bcCount} BC existant${bcCount > 1 ? 's' : ''}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            <div className="bc-from-devis-panel__actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!quoteId || createMut.isPending}
                onClick={handleCreate}
              >
                {createMut.isPending ? 'Création en cours…' : 'Créer le BC'}
              </button>
              {quoteId ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={createMut.isPending}
                  onClick={() => {
                    setQuoteId('')
                    createMut.reset()
                  }}
                >
                  Annuler
                </button>
              ) : null}
            </div>

            {createMut.isError ? (
              <p className="error bc-from-devis-panel__error">{(createMut.error as Error).message}</p>
            ) : null}
          </div>

          {selectedQuote ? (
            <aside className="bc-from-devis-panel__preview" aria-label="Aperçu du devis sélectionné">
              <h3 className="bc-from-devis-panel__preview-title">Devis sélectionné</h3>
              <dl className="bc-from-devis-panel__meta">
                <div>
                  <dt>Numéro</dt>
                  <dd>
                    <Link to={`/devis/${selectedQuote.id}/editer`} className="link-inline">
                      <code className="code-badge">{selectedQuote.number}</code>
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Client</dt>
                  <dd>{selectedQuote.client?.name ?? `Client #${selectedQuote.client_id}`}</dd>
                </div>
                <div>
                  <dt>Dossier</dt>
                  <dd>
                    {selectedQuote.dossier_id ? (
                      <Link to={`/dossiers/${selectedQuote.dossier_id}/devis`} className="link-inline">
                        {selectedQuote.dossier?.reference ?? `#${selectedQuote.dossier_id}`}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{formatAppDate(selectedQuote.quote_date)}</dd>
                </div>
                <div>
                  <dt>Montant TTC</dt>
                  <dd>{formatMoney(Number(selectedQuote.amount_ttc))}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>
                    {(() => {
                      const st = quoteStatutBadgeProps(selectedQuote.status)
                      return (
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                      )
                    })()}
                  </dd>
                </div>
              </dl>
            </aside>
          ) : (
            <aside className="bc-from-devis-panel__hint text-muted">
              Sélectionnez un devis pour afficher le détail avant création du bon de commande.
            </aside>
          )}
        </div>
      )}
    </section>
  )
}

export default function BonsCommandeListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statutFilter, setStatutFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BonCommande | null>(null)
  const [statusModalBc, setStatusModalBc] = useState<{ id: number; numero: string; statut: string } | null>(null)
  const [pdfTarget, setPdfTarget] = useState<BonCommande | null>(null)
  const [metaModalQuote, setMetaModalQuote] = useState<{
    id: number
    number: string
    meta: unknown
    bcNumero: string
  } | null>(null)

  const { visible, toggle } = usePersistedColumnVisibility('bons-commande', {
    number: true,
    devis: true,
    dossier: true,
    client: true,
    date: true,
    ht: true,
    ttc: true,
    status: true,
    bl: true,
    invoices: true,
    pdf: true,
    actions: true,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['bons-commande', debouncedSearch, statutFilter || 'all'],
    queryFn: () =>
      bonsCommandeApi.list({
        statut: statutFilter || undefined,
        search: debouncedSearch.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => bonsCommandeApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      void qc.invalidateQueries({ queryKey: ['quotes', 'eligible-bc'] })
      setDeleteTarget(null)
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: string }) => bonsCommandeApi.update(id, { statut }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      void qc.invalidateQueries({ queryKey: ['bon-commande', vars.id] })
      setStatusModalBc(null)
    },
  })

  const quoteMetaMut = useMutation({
    mutationFn: ({ id, meta }: { id: number; meta: EntityMetaPayload }) => quotesApi.update(id, { meta }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      void qc.invalidateQueries({ queryKey: ['quote', vars.id] })
      setMetaModalQuote(null)
    },
  })

  const bons = data ?? []
  const totals = useMemo(
    () => ({
      ht: sumNumeric(bons, (bc) => bc.montant_ht),
      ttc: sumNumeric(bons, (bc) => bc.montant_ttc),
    }),
    [bons],
  )
  const hasActiveFilters = searchInput.trim() !== '' || statutFilter !== ''

  const shellProps = {
    shellClassName: 'module-shell--crm' as const,
    breadcrumbs: [
      { label: 'Accueil', to: '/' },
      { label: 'Commercial', to: '/crm' },
      { label: 'Bons de commande' },
    ],
    moduleBarLabel: 'Commercial — Bons de commande',
    title: 'Bons de commande',
    subtitle: 'Bons de commande client (BCC) : suivi par dossier, montants et statuts de livraison.',
  }

  if (isLoading && !data) {
    return (
      <ModuleEntityShell {...shellProps} subtitle="Chargement…">
        <p className="text-muted">Chargement des bons de commande…</p>
      </ModuleEntityShell>
    )
  }

  if (error) {
    return (
      <ModuleEntityShell {...shellProps}>
        <p className="error">Erreur : {(error as Error).message}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell {...shellProps}>
      {isLab ? <BonCommandeCreateFromDevisPanel /> : null}

      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="N° BC, devis, client, référence ou titre dossier…"
        statusValue={statutFilter}
        onStatusChange={setStatutFilter}
        statusOptions={statusOptions}
        columns={[
          { id: 'number', label: 'Numéro' },
          { id: 'devis', label: 'Devis' },
          { id: 'dossier', label: 'Dossier' },
          { id: 'client', label: 'Client' },
          { id: 'date', label: 'Date commande' },
          { id: 'ht', label: 'Montant HT' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'status', label: 'Statut' },
          ...(isLab
            ? [
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
              {statutFilter ? (
                <span className="list-table-toolbar__chip">
                  <span className="list-table-toolbar__chip-text">
                    {STATUT_LABELS[statutFilter] ?? statutFilter}
                  </span>
                  <button
                    type="button"
                    className="list-table-toolbar__chip-remove"
                    onClick={() => setStatutFilter('')}
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
        <ListTablePanelHeader title="Bons de commande" count={bons.length} />
        {bons.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.number !== false && <th className="data-table__code">Numéro</th>}
                  {visible.devis !== false && <th className="data-table__code">Devis</th>}
                  {visible.dossier !== false && <th className="data-table__reference">Dossier</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.ht !== false && <th>HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.ttc !== false && <th>TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {isLab && visible.bl !== false && <th className="data-table__num">BL</th>}
                  {isLab && visible.invoices !== false && <th className="data-table__num">Factures</th>}
                  {isLab && visible.pdf !== false && <th className="data-table__pdf">PDF</th>}
                  {isLab && visible.actions !== false && <BonCommandeRowActionHeaders />}
                </tr>
              </thead>
              <tbody>
                {bons.map((bc) => {
                  const st = bonCommandeStatutBadgeProps(bc.statut)
                  const hasBl = bcHasBonLivraison(bc)
                  const capabilities = commercialDocumentCapabilities({
                    documentType: 'bon_commande',
                    status: bc.statut,
                    isLab,
                    isAdmin,
                    hasBonLivraison: hasBl,
                  })
                  const blCount = chainCount(bc.bons_livraison_count)
                  const invoiceCount = chainCount(bc.invoices_count)
                  return (
                    <tr
                      key={bc.id}
                      className="table-row-link"
                      onClick={(e) => {
                        if (shouldIgnoreTableRowClick(e.target)) return
                        navigate(`/bons-commande/${bc.id}`)
                      }}
                    >
                      {visible.number !== false && (
                        <td className="data-table__code">
                          <Link
                            to={`/bons-commande/${bc.id}`}
                            className="link-inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <code className="code-badge">{bc.numero}</code>
                          </Link>
                        </td>
                      )}
                      {visible.devis !== false && (
                        <td className="data-table__code">
                          {bc.quote_id && bc.quote?.number ? (
                            <Link
                              to={`/devis/${bc.quote_id}/editer`}
                              className="link-inline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <code className="code-badge">{bc.quote.number}</code>
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      )}
                      {visible.dossier !== false && (
                        <td className="data-table__reference">
                          {bc.dossier ? (
                            <Link
                              to={`/dossiers/${bc.dossier_id}/bc-bl`}
                              className="link-inline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {bc.dossier.reference ?? `#${bc.dossier_id}`}
                            </Link>
                          ) : (
                            `#${bc.dossier_id}`
                          )}
                        </td>
                      )}
                      {visible.client !== false && (
                        <td>{bc.dossier?.client?.name ?? bc.client?.name ?? '—'}</td>
                      )}
                      {visible.date !== false && <td>{formatAppDate(bc.date_commande)}</td>}
                      {visible.ht !== false && <td>{formatMoney(Number(bc.montant_ht))}</td>}
                      {visible.ttc !== false && <td>{formatMoney(Number(bc.montant_ttc))}</td>}
                      {visible.status !== false && (
                        <td className="data-table__status">
                          {isLab ? (
                            <ClickableStatusBadge
                              variant={st.variant}
                              size="sm"
                              ariaLabel={`Changer le statut du bon ${bc.numero}`}
                              onClick={() =>
                                setStatusModalBc({ id: bc.id, numero: bc.numero, statut: bc.statut })
                              }
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
                      {isLab && visible.bl !== false && (
                        <td className="data-table__num">{blCount > 0 ? blCount : <span className="text-muted">—</span>}</td>
                      )}
                      {isLab && visible.invoices !== false && (
                        <td className="data-table__num">
                          {invoiceCount > 0 ? invoiceCount : <span className="text-muted">—</span>}
                        </td>
                      )}
                      {isLab && visible.pdf !== false && (
                        <td className="data-table__pdf">
                          <QuotePdfButton
                            label="Télécharger le PDF"
                            onClick={() => setPdfTarget(bc)}
                          />
                        </td>
                      )}
                      {isLab && visible.actions !== false ? (
                        <BonCommandeRowActionCells
                          bcNumero={bc.numero}
                          canDelete={capabilities.canDelete}
                          onMeta={
                            bc.quote_id && bc.quote?.number
                              ? () =>
                                  setMetaModalQuote({
                                    id: bc.quote_id!,
                                    number: bc.quote!.number,
                                    meta: bc.quote?.meta,
                                    bcNumero: bc.numero,
                                  })
                              : undefined
                          }
                          onDelete={() => setDeleteTarget(bc)}
                        />
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
              <ListTableFootRow
                columns={[
                  { id: 'number', kind: 'text' },
                  { id: 'devis', kind: 'text' },
                  { id: 'dossier', kind: 'text' },
                  { id: 'client', kind: 'text' },
                  { id: 'date', kind: 'text' },
                  { id: 'ht', kind: 'money' },
                  { id: 'ttc', kind: 'money' },
                  { id: 'status', kind: 'text' },
                  ...(isLab
                    ? [
                        { id: 'bl', kind: 'text' as const },
                        { id: 'invoices', kind: 'text' as const },
                      ]
                    : []),
                  ...(isLab ? [{ id: 'pdf', kind: 'text' as const }] : []),
                  ...(isLab ? [{ id: 'actions', kind: 'text' as const, span: 2 }] : []),
                ]}
                visible={visible}
                totals={totals}
              />
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">
            {hasActiveFilters
              ? 'Aucun bon de commande ne correspond aux filtres.'
              : 'Aucun bon de commande pour le moment.'}
          </p>
        )}
      </div>

      {statusModalBc !== null ? (
        <StatusChangeModal
          title={`Statut — ${statusModalBc.numero}`}
          initialValue={statusModalBc.statut}
          options={statusOptions}
          isPending={statusMut.isPending}
          error={statusMut.isError ? (statusMut.error as Error).message : null}
          onClose={() => setStatusModalBc(null)}
          onSave={(statut) => statusMut.mutate({ id: statusModalBc.id, statut })}
        />
      ) : null}

      {metaModalQuote ? (
        <Modal
          title={`Métadonnées devis — ${metaModalQuote.number} (BC ${metaModalQuote.bcNumero})`}
          onClose={() => setMetaModalQuote(null)}
        >
          <EntityMetaCard
            meta={metaModalQuote.meta}
            editable
            onSave={(meta) => quoteMetaMut.mutateAsync({ id: metaModalQuote.id, meta })}
            isSaving={quoteMetaMut.isPending}
            saveError={quoteMetaMut.isError ? (quoteMetaMut.error as Error).message : null}
          />
        </Modal>
      ) : null}

      {pdfTarget ? (
        <DocumentPdfPickerModal
          documentType="purchase_order"
          documentId={pdfTarget.id}
          documentLabel={pdfTarget.numero}
          onClose={() => setPdfTarget(null)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer le bon de commande"
          message={
            <>
              Supprimer définitivement le bon <strong>{deleteTarget.numero}</strong> ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setDeleteTarget(null)
          }}
        />
      ) : null}
    </ModuleEntityShell>
  )
}
