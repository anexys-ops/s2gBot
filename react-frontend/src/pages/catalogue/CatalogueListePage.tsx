import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogueApi, type RefFamilleArticleRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ArbreCatalogue from '../../components/Catalogue/ArbreCatalogue'
import CatalogueProlabListe from '../../components/Catalogue/CatalogueProlabListe'
import CatalogueProlabTable from '../../components/Catalogue/CatalogueProlabTable'
import CatalogueArticleCreateModal from '../../components/Catalogue/CatalogueArticleCreateModal'
import ListTableToolbar from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'

type CatalogueViewMode = 'table' | 'list' | 'tree'

function parseViewMode(vue: string | null): CatalogueViewMode {
  if (vue === 'familles') return 'tree'
  if (vue === 'replis') return 'list'
  return 'table'
}

/**
 * BDC-111 — Liste catalogue PROLAB (tableau, replis, arbre + filtres).
 */
export default function CatalogueListePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [familleId, setFamilleId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [withInactif, setWithInactif] = useState(false)
  const [viewMode, setViewMode] = useState<CatalogueViewMode>(() => parseViewMode(searchParams.get('vue')))

  const { visible, toggle } = usePersistedColumnVisibility('catalogue-articles', {
    code: true,
    libelle: true,
    famille: true,
    unite: true,
    prix: true,
    tva: true,
    statut: true,
    actions: true,
  })

  useEffect(() => {
    setViewMode(parseViewMode(searchParams.get('vue')))
  }, [searchParams])

  const { data: familles } = useQuery({
    queryKey: ['catalogue-familles', withInactif],
    queryFn: () => catalogueApi.familles({ with_inactif: withInactif }),
  })

  const familleOptions = useMemo(() => familles ?? [], [familles])
  const selectedFamille = familleOptions.find((f) => f.id === familleId)

  const needsFlatArticles = viewMode === 'table' || viewMode === 'list'

  const { data: articlesFlat = [], isLoading: loadingFlat } = useQuery({
    queryKey: ['catalogue-articles-flat', familleId, withInactif, search],
    queryFn: () =>
      catalogueApi.articles({
        ref_famille_article_id: familleId === '' ? undefined : familleId,
        with_inactif: withInactif,
        q: search.trim() || undefined,
      }),
    enabled: needsFlatArticles,
  })

  const hasActiveFilters = search.trim() !== '' || familleId !== '' || withInactif

  const clearAllFilters = () => {
    setSearch('')
    setFamilleId('')
    setWithInactif(false)
  }

  const viewSubtitle = (() => {
    if (viewMode === 'tree') {
      return 'Vue arbre classique par familles.'
    }
    if (!loadingFlat) {
      const label =
        viewMode === 'table' ? 'vue tableau' : 'vue liste & replis'
      return `${articlesFlat.length} article(s) — ${label}`
    }
    return 'Tableau, liste repliable ou vue arbre — tarifs, tags, unités HFSQL.'
  })()

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Catalogue PROLAB' },
      ]}
      moduleBarLabel="Catalogue — PROLAB"
      title="Catalogue produits & essais"
      subtitle={viewSubtitle}
      actions={
        isAdmin ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            Nouvel article
          </button>
        ) : null
      }
    >
      <div className="catalogue-liste">
        <div className="catalogue-liste__view-toggle" role="tablist" aria-label="Mode d’affichage catalogue">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'table'}
            className={`catalogue-liste__view-btn ${viewMode === 'table' ? 'catalogue-liste__view-btn--active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Tableau
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'list'}
            className={`catalogue-liste__view-btn ${viewMode === 'list' ? 'catalogue-liste__view-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            Liste &amp; replis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'tree'}
            className={`catalogue-liste__view-btn ${viewMode === 'tree' ? 'catalogue-liste__view-btn--active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            Vue arbre
          </button>
        </div>

        <ListTableToolbar
          className={`catalogue-liste__toolbar${viewMode === 'table' ? ' catalogue-liste__toolbar--table' : ''}`}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Code, libellé, norme…"
          columns={
            viewMode === 'table'
              ? [
                  { id: 'code', label: 'Code' },
                  { id: 'libelle', label: 'Libellé' },
                  { id: 'famille', label: 'Famille' },
                  { id: 'unite', label: 'Unité' },
                  { id: 'prix', label: 'PU HT' },
                  { id: 'tva', label: 'TVA' },
                  { id: 'statut', label: 'Statut' },
                  { id: 'actions', label: 'Actions' },
                ]
              : undefined
          }
          visibleColumns={viewMode === 'table' ? visible : undefined}
          onToggleColumn={viewMode === 'table' ? toggle : undefined}
          extra={
            <>
              <label className="catalogue-liste__famille-field">
                <span className="filter-label">Famille</span>
                <select
                  value={familleId === '' ? '' : String(familleId)}
                  onChange={(e) => setFamilleId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">Toutes les familles</option>
                  {familleOptions.map((f: RefFamilleArticleRow) => (
                    <option key={f.id} value={f.id}>
                      {f.code} — {f.libelle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="catalogue-liste__inactif-field">
                <span className="filter-label">Affichage</span>
                <span className="catalogue-liste__inactif-control">
                  <input type="checkbox" checked={withInactif} onChange={(e) => setWithInactif(e.target.checked)} />
                  <span>Inclure inactifs</span>
                </span>
              </label>
            </>
          }
          footer={
            <>
              {familleOptions.length > 0 && (
                <div className="catalogue-liste__famille-section">
                  <span className="list-table-toolbar__footer-label">Familles</span>
                  <div className="catalogue-liste__famille-chips" aria-label="Filtrer par famille">
                    <button
                      type="button"
                      className={`catalogue-liste__chip ${familleId === '' ? 'catalogue-liste__chip--active catalogue-liste__chip--neutral' : ''}`}
                      aria-pressed={familleId === ''}
                      onClick={() => setFamilleId('')}
                    >
                      Toutes
                    </button>
                    {familleOptions.map((f) => {
                      const active = familleId === f.id
                      const dot = f.color ?? '#9ca3af'
                      return (
                        <button
                          key={f.id}
                          type="button"
                          className={`catalogue-liste__chip ${active ? 'catalogue-liste__chip--active' : ''}`}
                          aria-pressed={active}
                          onClick={() => setFamilleId(f.id)}
                          title={f.type_ressource ? `Ressource : ${f.type_ressource}` : undefined}
                          style={
                            active
                              ? ({ '--catalogue-chip-color': dot } as CSSProperties)
                              : ({ '--catalogue-chip-dot': dot } as CSSProperties)
                          }
                        >
                          <span className="catalogue-liste__chip-dot" aria-hidden />
                          {f.libelle}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {hasActiveFilters && (
                <div className="catalogue-liste__active-filters">
                  <span className="list-table-toolbar__footer-label">Filtres actifs</span>
                  {search.trim() !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">Recherche : « {search.trim()} »</span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => setSearch('')}
                        aria-label="Retirer la recherche"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {familleId !== '' && selectedFamille && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">
                        Famille : {selectedFamille.code} — {selectedFamille.libelle}
                      </span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => setFamilleId('')}
                        aria-label="Retirer le filtre famille"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {withInactif && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">Inclure inactifs</span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => setWithInactif(false)}
                        aria-label="Masquer les inactifs"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
                    Tout effacer
                  </button>
                </div>
              )}
            </>
          }
        />

        {viewMode === 'table' && (
          <CatalogueProlabTable articles={articlesFlat} isLoading={loadingFlat} visibleColumns={visible} />
        )}

        {viewMode === 'list' && (
          <CatalogueProlabListe articles={articlesFlat} isLoading={loadingFlat} />
        )}

        {viewMode === 'tree' && (
          <>
            <p className="catalogue-liste__legend" role="note">
              <span className="catalogue-liste__legend-item" title="Béton">
                🧱 Béton
              </span>
              <span className="catalogue-liste__legend-item" title="Sols / compactage">
                ⚙️ Sols / compactage
              </span>
              <span className="catalogue-liste__legend-item" title="Produits manufacturés">
                📐 Produits manufacturés
              </span>
            </p>
            <ArbreCatalogue
              withInactif={withInactif}
              familleIdFilter={familleId === '' ? undefined : familleId}
              searchQuery={search}
              linkToArticleFiche
            />
          </>
        )}
      </div>

      {showCreateModal && isAdmin && (
        <CatalogueArticleCreateModal
          familleOptions={familleOptions}
          defaultFamilleId={familleId}
          onClose={() => setShowCreateModal(false)}
          onCreated={(article) => {
            setShowCreateModal(false)
            void queryClient.invalidateQueries({ queryKey: ['catalogue-articles-flat'] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue-familles'] })
            void queryClient.invalidateQueries({ queryKey: ['catalogue-arbre'] })
            navigate(`/catalogue/articles/${article.id}`)
          }}
        />
      )}
    </ModuleEntityShell>
  )
}
