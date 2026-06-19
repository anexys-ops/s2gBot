import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogueApi, type RefArticleKind, type RefFamilleArticleRow } from '../../api/client'
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
  const [articleKind, setArticleKind] = useState<RefArticleKind | ''>('')
  const [qualificationTagCode, setQualificationTagCode] = useState('')
  const [search, setSearch] = useState('')
  const [withInactif, setWithInactif] = useState(false)
  const [viewMode, setViewMode] = useState<CatalogueViewMode>(() => parseViewMode(searchParams.get('vue')))

  const { visible, toggle } = usePersistedColumnVisibility('catalogue-articles', {
    kind: true,
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

  const { data: qualificationTags = [] } = useQuery({
    queryKey: ['catalogue-qualification-tags'],
    queryFn: () => catalogueApi.qualificationTags(),
  })

  const { data: articlesFlat = [], isLoading: loadingFlat } = useQuery({
    queryKey: ['catalogue-articles-flat', familleId, withInactif, search, articleKind, qualificationTagCode],
    queryFn: () =>
      catalogueApi.articles({
        ref_famille_article_id: familleId === '' ? undefined : familleId,
        with_inactif: withInactif,
        q: search.trim() || undefined,
        kind: articleKind === '' ? undefined : articleKind,
        qualification_tag_code: qualificationTagCode.trim() || undefined,
      }),
    enabled: needsFlatArticles,
  })

  const hasActiveFilters =
    search.trim() !== '' ||
    familleId !== '' ||
    withInactif ||
    articleKind !== '' ||
    qualificationTagCode.trim() !== ''

  const clearAllFilters = () => {
    setSearch('')
    setFamilleId('')
    setWithInactif(false)
    setArticleKind('')
    setQualificationTagCode('')
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
        { label: 'Catalogue' },
      ]}
      moduleBarLabel="Catalogue — S2G"
      title="Catalogue jalons & produits"
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
                  { id: 'kind', label: 'Type' },
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
                <span className="filter-label">Type S2G</span>
                <select
                  value={articleKind}
                  onChange={(e) => setArticleKind((e.target.value || '') as RefArticleKind | '')}
                >
                  <option value="">Tous types</option>
                  <option value="jalon">Jalons</option>
                  <option value="product">Produits</option>
                  <option value="legacy">Ancien PROLAB</option>
                </select>
              </label>
              <label className="catalogue-liste__famille-field">
                <span className="filter-label">Qualification</span>
                <select
                  value={qualificationTagCode}
                  onChange={(e) => setQualificationTagCode(e.target.value)}
                  disabled={articleKind === 'product' || articleKind === 'legacy'}
                >
                  <option value="">Toutes qualifications</option>
                  {qualificationTags.map((tag) => (
                    <option key={tag.id} value={tag.code}>
                      {tag.display_label}
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
                  {articleKind !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">
                        Type : {articleKind === 'jalon' ? 'Jalons' : articleKind === 'product' ? 'Produits' : 'Legacy'}
                      </span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => setArticleKind('')}
                        aria-label="Retirer le filtre type"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {qualificationTagCode.trim() !== '' && (
                    <span className="list-table-toolbar__chip">
                      <span className="list-table-toolbar__chip-text">
                        Qualification :{' '}
                        {qualificationTags.find((t) => t.code === qualificationTagCode)?.display_label ??
                          qualificationTagCode}
                      </span>
                      <button
                        type="button"
                        className="list-table-toolbar__chip-remove"
                        onClick={() => setQualificationTagCode('')}
                        aria-label="Retirer le filtre qualification"
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
          <>
            {!loadingFlat && articlesFlat.length === 0 && (
              <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0 }}>
                  Aucun article S2G dans le catalogue.
                  {qualificationTags.length === 0
                    ? ' L’import n’a pas encore été exécuté sur ce serveur — lancez `php artisan catalogue:import-s2g --force` (Docker : voir doc S2G).'
                    : ' Essayez d’effacer les filtres actifs.'}
                </p>
              </div>
            )}
            <CatalogueProlabTable articles={articlesFlat} isLoading={loadingFlat} visibleColumns={visible} />
          </>
        )}

        {viewMode === 'list' && (
          <CatalogueProlabListe articles={articlesFlat} isLoading={loadingFlat} />
        )}

        {viewMode === 'tree' && (
          <ArbreCatalogue
            withInactif={withInactif}
            familleIdFilter={familleId === '' ? undefined : familleId}
            searchQuery={search}
            linkToArticleFiche
          />
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
