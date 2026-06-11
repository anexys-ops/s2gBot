import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { bonsCommandeApi, devisV1Api, quotesApi, type BonCommande, type Quote } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge, { bonCommandeStatutBadgeProps, quoteStatutBadgeProps } from '../../components/ds/StatusBadge'
import ListTableToolbar from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import TableRowActions from '../../components/TableRowActions'
import { useAuth } from '../../contexts/AuthContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'
import { formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  livre: 'Livré',
  annule: 'Annulé',
}

const statusOptions = Object.entries(STATUT_LABELS).map(([value, label]) => ({ value, label }))

function BonCommandeCreateFromDevisPanel() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [quoteId, setQuoteId] = useState('')

  const { data: eligiblePage, isLoading, isError, error } = useQuery({
    queryKey: ['quotes', 'eligible-bc'],
    queryFn: () => quotesApi.listEligibleForBc(),
  })

  const eligibleQuotes = eligiblePage?.data ?? []

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
          <strong>accepté</strong>, rattaché à un dossier et sans BC existant.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted bc-from-devis-panel__status">Chargement des devis éligibles…</p>
      ) : isError ? (
        <p className="error bc-from-devis-panel__status">{(error as Error).message}</p>
      ) : eligibleQuotes.length === 0 ? (
        <div className="bc-from-devis-panel__empty dossier-tab-empty">
          <p>Aucun devis éligible pour le moment.</p>
          <ul className="bc-from-devis-panel__criteria">
            <li>Statut : signé ou accepté</li>
            <li>Rattaché à un dossier chantier</li>
            <li>Sans bon de commande déjà créé</li>
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
              <span className="bc-from-devis-panel__label">Devis source</span>
              <select
                value={quoteId}
                onChange={(e) => {
                  setQuoteId(e.target.value)
                  createMut.reset()
                }}
              >
                <option value="">Sélectionner un devis…</option>
                {eligibleQuotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {formatQuoteOptionLabel(quote)}
                  </option>
                ))}
              </select>
            </label>

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
                    <Link to={`/devis/${selectedQuote.id}`} className="link-inline">
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

function formatQuoteOptionLabel(quote: Quote): string {
  const client = quote.client?.name ?? `Client #${quote.client_id}`
  const dossierRef = quote.dossier?.reference ?? (quote.dossier_id ? `#${quote.dossier_id}` : '—')
  const amount = formatMoney(Number(quote.amount_ttc))
  return `${quote.number} — ${client} — ${dossierRef} — ${amount} TTC`
}

export default function BonsCommandeListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statutFilter, setStatutFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BonCommande | null>(null)

  const { visible, toggle } = usePersistedColumnVisibility('bons-commande', {
    number: true,
    dossier: true,
    client: true,
    date: true,
    ht: true,
    ttc: true,
    status: true,
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

  const bons = data ?? []
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
        searchPlaceholder="N° BC, client, référence ou titre dossier…"
        statusValue={statutFilter}
        onStatusChange={setStatutFilter}
        statusOptions={statusOptions}
        columns={[
          { id: 'number', label: 'Numéro' },
          { id: 'dossier', label: 'Dossier' },
          { id: 'client', label: 'Client' },
          { id: 'date', label: 'Date commande' },
          { id: 'ht', label: 'Montant HT' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'status', label: 'Statut' },
          { id: 'actions', label: 'Actions' },
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
        {bons.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.number !== false && <th>Numéro</th>}
                  {visible.dossier !== false && <th>Dossier</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.date !== false && <th>Date</th>}
                  {visible.ht !== false && <th>HT ({MONEY_UNIT_LABEL})</th>}
                  {visible.ttc !== false && <th>TTC ({MONEY_UNIT_LABEL})</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {visible.actions !== false && <th className="data-table__actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {bons.map((bc) => {
                  const st = bonCommandeStatutBadgeProps(bc.statut)
                  return (
                    <tr
                      key={bc.id}
                      className="table-row-link"
                      onClick={(e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a, button')) return
                        navigate(`/bons-commande/${bc.id}`)
                      }}
                    >
                      {visible.number !== false && (
                        <td>
                          <Link
                            to={`/bons-commande/${bc.id}`}
                            className="link-inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <code className="code-badge">{bc.numero}</code>
                          </Link>
                        </td>
                      )}
                      {visible.dossier !== false && (
                        <td>
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
                          <StatusBadge variant={st.variant} size="sm">
                            {st.label}
                          </StatusBadge>
                        </td>
                      )}
                      {visible.actions !== false && (
                        <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                          {isLab ? (
                            <TableRowActions
                              onEdit={() => navigate(`/bons-commande/${bc.id}`)}
                              onDelete={() => setDeleteTarget(bc)}
                              editLabel={`Ouvrir le bon ${bc.numero}`}
                              deleteLabel={`Supprimer le bon ${bc.numero}`}
                            />
                          ) : (
                            <Link to={`/bons-commande/${bc.id}`} className="btn btn-secondary btn-sm">
                              Ouvrir
                            </Link>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
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
