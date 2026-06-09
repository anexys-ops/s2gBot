import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { clientsApi, dossiersApi, type DossierRow, type DossierStatut } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import DossierCard from '../../components/Dossiers/DossierCard'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import StatusBadge, { dossierStatutBadgeProps } from '../../components/ds/StatusBadge'
import ListTableToolbar, { PaginationBar } from '../../components/ListTableToolbar'
import TableRowActions from '../../components/TableRowActions'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'

const STATUT_LABELS: Record<DossierStatut, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  cloture: 'Clôturé',
  archive: 'Archivé',
}

const STATUT_OPTIONS = (Object.keys(STATUT_LABELS) as DossierStatut[]).map((v) => ({
  value: v,
  label: STATUT_LABELS[v],
}))

export default function DossiersListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [clientFilter, setClientFilter] = useState('')
  const [statut, setStatut] = useState<DossierStatut | ''>('')
  const [dateDebutFrom, setDateDebutFrom] = useState('')
  const [dateDebutTo, setDateDebutTo] = useState('')
  const [page, setPage] = useState(1)
  const [dossierToDelete, setDossierToDelete] = useState<DossierRow | null>(null)
  const perPage = 20

  const { visible, toggle } = usePersistedColumnVisibility('dossiers', {
    reference: true,
    titre: true,
    client: true,
    site: true,
    statut: true,
    dateDebut: true,
    actions: true,
  })

  const clientFilterId = clientFilter ? Number(clientFilter) : undefined

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'select-options'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
    staleTime: 60_000,
  })

  const clients = Array.isArray(clientsData) ? clientsData : []

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'dossiers',
      'paginated',
      debouncedSearch,
      clientFilter,
      statut,
      dateDebutFrom,
      dateDebutTo,
      page,
      perPage,
    ],
    queryFn: () =>
      dossiersApi.listPaginated({
        search: debouncedSearch.trim() || undefined,
        client_id: clientFilterId && Number.isFinite(clientFilterId) ? clientFilterId : undefined,
        statut: statut !== '' ? statut : undefined,
        date_debut_from: dateDebutFrom || undefined,
        date_debut_to: dateDebutTo || undefined,
        page,
        per_page: perPage,
      }),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, clientFilter, statut, dateDebutFrom, dateDebutTo])

  const deleteMut = useMutation({
    mutationFn: (id: number) => dossiersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dossiers'] })
      setDossierToDelete(null)
    },
  })

  const clientMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of clients) {
      m.set(c.id, c.name)
    }
    return m
  }, [clients])

  const list = data?.data ?? []
  const total = data?.total ?? 0
  const lastPage = data?.last_page ?? 1
  const currentPage = data?.current_page ?? page

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    clientFilter !== '' ||
    statut !== '' ||
    dateDebutFrom !== '' ||
    dateDebutTo !== ''

  const clearAllFilters = () => {
    setSearchInput('')
    setClientFilter('')
    setStatut('')
    setDateDebutFrom('')
    setDateDebutTo('')
    setPage(1)
  }

  const isInitialLoading = isLoading && !data

  if (isInitialLoading) {
    return (
      <ModuleEntityShell
        shellClassName="module-shell--crm"
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Commercial', to: '/crm' },
          { label: 'Dossiers chantier' },
        ]}
        moduleBarLabel="Commercial — Dossiers chantier"
        title="Dossiers chantier (PROLAB)"
      >
        <p>Chargement…</p>
      </ModuleEntityShell>
    )
  }

  if (error) {
    return (
      <ModuleEntityShell
        shellClassName="module-shell--crm"
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Commercial', to: '/crm' },
          { label: 'Dossiers chantier' },
        ]}
        moduleBarLabel="Commercial — Dossiers chantier"
        title="Dossiers chantier (PROLAB)"
      >
        <p className="error">Erreur : {(error as Error).message}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Commercial', to: '/crm' },
        { label: 'Dossiers chantier' },
      ]}
      moduleBarLabel="Commercial — Dossiers chantier"
      title="Dossiers chantier (PROLAB)"
      subtitle={
        total > 0
          ? `${total} dossier(s) — page ${currentPage} / ${lastPage}`
          : 'Aucun dossier pour cette vue'
      }
      actions={
        isLab ? (
          <Link to="/dossiers/new" className="btn btn-primary btn-sm">
            Nouveau dossier
          </Link>
        ) : null
      }
    >
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Référence, titre, client, chantier…"
        statusValue={statut}
        onStatusChange={(v) => setStatut((v || '') as DossierStatut | '')}
        statusOptions={isLab ? STATUT_OPTIONS : undefined}
        columns={[
          { id: 'reference', label: 'Référence' },
          { id: 'titre', label: 'Titre' },
          { id: 'client', label: 'Client' },
          { id: 'site', label: 'Chantier' },
          { id: 'statut', label: 'Statut' },
          { id: 'dateDebut', label: 'Début' },
          ...(isLab ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
        extra={
          isLab ? (
            <label>
              <span className="filter-label">Filtrer par client</span>
              <select
                value={clientFilter}
                onChange={(e) => {
                  setClientFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Tous les clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        footer={
          isLab ? (
            <>
              <div className="list-table-toolbar__date-row">
                <label>
                  <span className="filter-label">Période (début ≥)</span>
                  <input
                    type="date"
                    value={dateDebutFrom}
                    onChange={(e) => {
                      setDateDebutFrom(e.target.value)
                      setPage(1)
                    }}
                  />
                </label>
                <label>
                  <span className="filter-label">Période (début ≤)</span>
                  <input
                    type="date"
                    value={dateDebutTo}
                    onChange={(e) => {
                      setDateDebutTo(e.target.value)
                      setPage(1)
                    }}
                  />
                </label>
              </div>
              {hasActiveFilters ? (
                <>
                  <span className="list-table-toolbar__footer-label">Filtres actifs</span>
                  {debouncedSearch.trim() !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">Recherche : « {debouncedSearch.trim()} »</span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => {
                          setSearchInput('')
                          setPage(1)
                        }}
                        aria-label="Retirer la recherche"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {clientFilter !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">
                        Client : {clients.find((c) => String(c.id) === clientFilter)?.name ?? clientFilter}
                      </span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => {
                          setClientFilter('')
                          setPage(1)
                        }}
                        aria-label="Retirer le filtre client"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {statut !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">{STATUT_LABELS[statut]}</span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => {
                          setStatut('')
                          setPage(1)
                        }}
                        aria-label="Retirer le filtre statut"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {dateDebutFrom !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">Début ≥ {dateDebutFrom}</span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => {
                          setDateDebutFrom('')
                          setPage(1)
                        }}
                        aria-label="Retirer la date de début minimale"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {dateDebutTo !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">Début ≤ {dateDebutTo}</span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => {
                          setDateDebutTo('')
                          setPage(1)
                        }}
                        aria-label="Retirer la date de début maximale"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
                    Tout effacer
                  </button>
                </>
              ) : null}
            </>
          ) : undefined
        }
      />

      <div className="dossiers-grid--cards">
        {list.map((d) => (
          <DossierCard key={d.id} row={d} clientName={clientMap.get(d.client_id)} />
        ))}
      </div>

      <div className="card dossiers-table-desktop" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                {visible.reference !== false && <th>Référence</th>}
                {visible.titre !== false && <th>Titre</th>}
                {visible.client !== false && <th>Client</th>}
                {visible.site !== false && <th>Chantier</th>}
                {visible.statut !== false && <th>Statut</th>}
                {visible.dateDebut !== false && <th>Début</th>}
                {isLab && visible.actions !== false && <th className="data-table__actions">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const st = dossierStatutBadgeProps(d.statut)
                return (
                  <tr
                    key={d.id}
                    className="table-row-link"
                    onClick={(e) => {
                      const t = e.target as HTMLElement
                      if (t.closest('a, button')) return
                      navigate(`/dossiers/${d.id}`)
                    }}
                  >
                    {visible.reference !== false && (
                      <td>
                        <Link to={`/dossiers/${d.id}`} onClick={(e) => e.stopPropagation()}>
                          <code>{d.reference}</code>
                        </Link>
                      </td>
                    )}
                    {visible.titre !== false && <td>{d.titre}</td>}
                    {visible.client !== false && (
                      <td>{d.client?.name ?? clientMap.get(d.client_id) ?? `#${d.client_id}`}</td>
                    )}
                    {visible.site !== false && <td>{d.site?.name ?? `Chantier #${d.site_id}`}</td>}
                    {visible.statut !== false && (
                      <td className="data-table__status">
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                      </td>
                    )}
                    {visible.dateDebut !== false && (
                      <td>{d.date_debut ? new Date(d.date_debut).toLocaleDateString('fr-FR') : '—'}</td>
                    )}
                    {isLab && visible.actions !== false && (
                      <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                        <TableRowActions
                          editLabel="Ouvrir le dossier"
                          deleteLabel="Supprimer le dossier"
                          onEdit={() => navigate(`/dossiers/${d.id}`)}
                          onDelete={() => setDossierToDelete(d)}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <p style={{ padding: '1rem' }}>Aucun dossier pour cette vue.</p>}
        <PaginationBar page={currentPage} lastPage={lastPage} onPage={setPage} />
      </div>

      {dossierToDelete && (
        <ConfirmDialog
          title="Supprimer le dossier"
          message={
            <>
              Supprimer définitivement le dossier <strong>« {dossierToDelete.reference} »</strong> ?
              <br />
              Cette action est irréversible.
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(dossierToDelete.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setDossierToDelete(null)
          }}
        />
      )}
    </ModuleEntityShell>
  )
}
