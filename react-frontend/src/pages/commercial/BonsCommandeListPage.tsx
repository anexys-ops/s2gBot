import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { bonsCommandeApi, devisV1Api, quotesApi, type BonCommande } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge, { bonCommandeStatutBadgeProps } from '../../components/ds/StatusBadge'
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

export default function BonsCommandeListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statutFilter, setStatutFilter] = useState('')
  const [quoteId, setQuoteId] = useState('')
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

  const { data: signedQuotes } = useQuery({
    queryKey: ['quotes', 'bc-source', 'signed'],
    queryFn: () => quotesApi.list({ status: 'signed' }),
    enabled: isLab,
  })
  const { data: acceptedQuotes } = useQuery({
    queryKey: ['quotes', 'bc-source', 'accepted'],
    queryFn: () => quotesApi.list({ status: 'accepted' }),
    enabled: isLab,
  })
  const { data: validatedQuotes } = useQuery({
    queryKey: ['quotes', 'bc-source', 'validated'],
    queryFn: () => quotesApi.list({ status: 'validated' }),
    enabled: isLab,
  })

  const quoteOptions = [
    ...(signedQuotes?.data ?? []),
    ...(acceptedQuotes?.data ?? []),
    ...(validatedQuotes?.data ?? []),
  ].filter((q, index, arr) => q.dossier_id && arr.findIndex((x) => x.id === q.id) === index)

  const createMut = useMutation({
    mutationFn: () => devisV1Api.transformerBc(Number(quoteId)),
    onSuccess: (bc) => {
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      setQuoteId('')
      if (bc?.id) navigate(`/bons-commande/${bc.id}`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => bonsCommandeApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
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
      {isLab && (
        <section className="card ds-form-section" style={{ marginBottom: '1rem' }}>
          <h2 className="ds-form-section__title" style={{ marginTop: 0 }}>
            Créer depuis un devis
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
            Transformation depuis un devis signé, accepté ou validé rattaché à un dossier chantier.
          </p>
          <div className="crud-actions" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem' }}>
            <label className="form-group" style={{ margin: 0, minWidth: 'min(100%, 22rem)' }}>
              Devis source
              <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
                <option value="">Choisir un devis signé / accepté avec dossier…</option>
                {quoteOptions.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.number} — {quote.client?.name ?? `Client #${quote.client_id}`} — dossier #
                    {quote.dossier_id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!quoteId || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Création…' : 'Créer le BC'}
            </button>
          </div>
          {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
        </section>
      )}

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
