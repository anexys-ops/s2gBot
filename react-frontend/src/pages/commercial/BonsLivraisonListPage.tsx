import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { bonsCommandeApi, bonsLivraisonApi, type BonCommande, type BonLivraison } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge, { bonLivraisonStatutBadgeProps } from '../../components/ds/StatusBadge'
import ListTableToolbar from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import TableRowActions from '../../components/TableRowActions'
import { useAuth } from '../../contexts/AuthContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'
import { formatAppDate } from '../../lib/appLocale'

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  livre: 'Livré',
  signe: 'Signé',
}

const statusOptions = Object.entries(STATUT_LABELS).map(([value, label]) => ({ value, label }))

const BC_STATUTS_FOR_BL = ['confirme', 'en_cours', 'livre'] as const

function BonLivraisonCreateFromBcPanel() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [bcId, setBcId] = useState('')

  const { data: bcOptions = [], isLoading } = useQuery({
    queryKey: ['bons-commande', 'bl-source'],
    queryFn: async () => {
      const lists = await Promise.all(
        BC_STATUTS_FOR_BL.map((statut) => bonsCommandeApi.list({ statut })),
      )
      const merged = lists.flat()
      return merged.filter((bc, index, arr) => arr.findIndex((x) => x.id === bc.id) === index)
    },
  })

  const selectedBc = useMemo(
    () => bcOptions.find((bc) => String(bc.id) === bcId),
    [bcOptions, bcId],
  )

  const createMut = useMutation({
    mutationFn: (id: number) => bonsCommandeApi.transformerBl(id),
    onSuccess: (bl) => {
      void qc.invalidateQueries({ queryKey: ['bons-livraison'] })
      setBcId('')
      if (bl?.id) navigate(`/bons-livraison/${bl.id}`)
    },
  })

  return (
    <section className="card bc-from-devis-panel" aria-labelledby="bl-from-bc-title">
      <header className="bc-from-devis-panel__header">
        <h2 id="bl-from-bc-title" className="bc-from-devis-panel__title">
          Créer depuis un bon de commande
        </h2>
        <p className="bc-from-devis-panel__intro text-muted">
          Générez un bon de livraison (BLC) à partir d&apos;un BC <strong>confirmé</strong>,{' '}
          <strong>en cours</strong> ou <strong>livré</strong>.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted bc-from-devis-panel__status">Chargement des bons de commande…</p>
      ) : bcOptions.length === 0 ? (
        <div className="bc-from-devis-panel__empty dossier-tab-empty">
          <p>Aucun bon de commande éligible pour le moment.</p>
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
              <span className="bc-from-devis-panel__label">Bon de commande source</span>
              <select
                value={bcId}
                onChange={(e) => {
                  setBcId(e.target.value)
                  createMut.reset()
                }}
              >
                <option value="">Sélectionner un BC…</option>
                {bcOptions.map((bc) => (
                  <option key={bc.id} value={bc.id}>
                    {formatBcOptionLabel(bc)}
                  </option>
                ))}
              </select>
            </label>

            <div className="bc-from-devis-panel__actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!bcId || createMut.isPending}
                onClick={() => createMut.mutate(Number(bcId))}
              >
                {createMut.isPending ? 'Création en cours…' : 'Créer le BL'}
              </button>
              {bcId ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={createMut.isPending}
                  onClick={() => {
                    setBcId('')
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

          {selectedBc ? (
            <aside className="bc-from-devis-panel__preview" aria-label="Aperçu du BC sélectionné">
              <h3 className="bc-from-devis-panel__preview-title">BC sélectionné</h3>
              <dl className="bc-from-devis-panel__meta">
                <div>
                  <dt>Numéro</dt>
                  <dd>
                    <Link to={`/bons-commande/${selectedBc.id}`} className="link-inline">
                      <code className="code-badge">{selectedBc.numero}</code>
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Client</dt>
                  <dd>{selectedBc.client?.name ?? `Client #${selectedBc.client_id}`}</dd>
                </div>
                <div>
                  <dt>Dossier</dt>
                  <dd>
                    <Link to={`/dossiers/${selectedBc.dossier_id}/bc-bl`} className="link-inline">
                      {selectedBc.dossier?.reference ?? `#${selectedBc.dossier_id}`}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Date commande</dt>
                  <dd>{formatAppDate(selectedBc.date_commande)}</dd>
                </div>
              </dl>
            </aside>
          ) : (
            <aside className="bc-from-devis-panel__hint text-muted">
              Sélectionnez un bon de commande pour afficher le détail avant création du BL.
            </aside>
          )}
        </div>
      )}
    </section>
  )
}

function formatBcOptionLabel(bc: BonCommande): string {
  const client = bc.client?.name ?? `Client #${bc.client_id}`
  const dossierRef = bc.dossier?.reference ?? `#${bc.dossier_id}`
  return `${bc.numero} — ${client} — ${dossierRef}`
}

export default function BonsLivraisonListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statutFilter, setStatutFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BonLivraison | null>(null)

  const { visible, toggle } = usePersistedColumnVisibility('bons-livraison', {
    number: true,
    dossier: true,
    client: true,
    bc: true,
    date: true,
    status: true,
    actions: true,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['bons-livraison', debouncedSearch, statutFilter || 'all'],
    queryFn: () =>
      bonsLivraisonApi.list({
        statut: statutFilter || undefined,
        search: debouncedSearch.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => bonsLivraisonApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bons-livraison'] })
      setDeleteTarget(null)
    },
  })

  const bls = data ?? []
  const hasActiveFilters = searchInput.trim() !== '' || statutFilter !== ''

  const shellProps = {
    shellClassName: 'module-shell--crm' as const,
    breadcrumbs: [
      { label: 'Accueil', to: '/' },
      { label: 'Commercial', to: '/crm' },
      { label: 'Bons de livraison' },
    ],
    moduleBarLabel: 'Commercial — Bons de livraison',
    title: 'Bons de livraison',
    subtitle: 'Bons de livraison client (BLC) : suivi par dossier, BC source et statuts de livraison.',
  }

  if (isLoading && !data) {
    return (
      <ModuleEntityShell {...shellProps} subtitle="Chargement…">
        <p className="text-muted">Chargement des bons de livraison…</p>
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
      {isLab ? <BonLivraisonCreateFromBcPanel /> : null}

      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="N° BL, BC, client, référence ou titre dossier…"
        statusValue={statutFilter}
        onStatusChange={setStatutFilter}
        statusOptions={statusOptions}
        columns={[
          { id: 'number', label: 'Numéro' },
          { id: 'dossier', label: 'Dossier' },
          { id: 'client', label: 'Client' },
          { id: 'bc', label: 'BC source' },
          { id: 'date', label: 'Date livraison' },
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
        {bls.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  {visible.number !== false && <th>Numéro</th>}
                  {visible.dossier !== false && <th>Dossier</th>}
                  {visible.client !== false && <th>Client</th>}
                  {visible.bc !== false && <th>BC source</th>}
                  {visible.date !== false && <th>Date livraison</th>}
                  {visible.status !== false && <th>Statut</th>}
                  {visible.actions !== false && <th className="data-table__actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {bls.map((bl) => {
                  const st = bonLivraisonStatutBadgeProps(bl.statut)
                  const canDelete = isLab && bl.statut === 'brouillon'
                  return (
                    <tr
                      key={bl.id}
                      className="table-row-link"
                      onClick={(e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a, button')) return
                        navigate(`/bons-livraison/${bl.id}`)
                      }}
                    >
                      {visible.number !== false && (
                        <td>
                          <Link
                            to={`/bons-livraison/${bl.id}`}
                            className="link-inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <code className="code-badge">{bl.numero}</code>
                          </Link>
                        </td>
                      )}
                      {visible.dossier !== false && (
                        <td>
                          {bl.dossier ? (
                            <Link
                              to={`/dossiers/${bl.dossier_id}/bc-bl`}
                              className="link-inline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {bl.dossier.reference ?? `#${bl.dossier_id}`}
                            </Link>
                          ) : (
                            `#${bl.dossier_id}`
                          )}
                        </td>
                      )}
                      {visible.client !== false && (
                        <td>{bl.dossier?.client?.name ?? bl.client?.name ?? '—'}</td>
                      )}
                      {visible.bc !== false && (
                        <td>
                          {bl.bon_commande_id ? (
                            <Link
                              to={`/bons-commande/${bl.bon_commande_id}`}
                              className="link-inline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {bl.bonCommande?.numero ?? `#${bl.bon_commande_id}`}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visible.date !== false && <td>{formatAppDate(bl.date_livraison)}</td>}
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
                              onEdit={() => navigate(`/bons-livraison/${bl.id}`)}
                              onDelete={canDelete ? () => setDeleteTarget(bl) : undefined}
                              editLabel={`Ouvrir le bon ${bl.numero}`}
                              deleteLabel={`Supprimer le bon ${bl.numero}`}
                            />
                          ) : (
                            <Link to={`/bons-livraison/${bl.id}`} className="btn btn-secondary btn-sm">
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
              ? 'Aucun bon de livraison ne correspond aux filtres.'
              : 'Aucun bon de livraison pour le moment.'}
          </p>
        )}
      </div>

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer le bon de livraison"
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
