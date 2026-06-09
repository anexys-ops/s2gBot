import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { catalogueApi, type RefFamilleArticleRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ArbreCatalogue from '../../components/Catalogue/ArbreCatalogue'
import CatalogueProlabListe from '../../components/Catalogue/CatalogueProlabListe'
import ListTableToolbar from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

/**
 * BDC-111 — Liste catalogue PROLAB (arbre + filtres).
 */
export default function CatalogueListePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const [searchParams] = useSearchParams()
  const [familleId, setFamilleId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [withInactif, setWithInactif] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'tree'>(searchParams.get('vue') === 'familles' ? 'tree' : 'list')

  useEffect(() => {
    setViewMode(searchParams.get('vue') === 'familles' ? 'tree' : 'list')
  }, [searchParams])

  const { data: familles } = useQuery({
    queryKey: ['catalogue-familles', withInactif],
    queryFn: () => catalogueApi.familles({ with_inactif: withInactif }),
  })

  const familleOptions = useMemo(() => familles ?? [], [familles])
  const selectedFamille = familleOptions.find((f) => f.id === familleId)

  const { data: articlesFlat = [], isLoading: loadingFlat } = useQuery({
    queryKey: ['catalogue-articles-flat', familleId, withInactif, search],
    queryFn: () =>
      catalogueApi.articles({
        ref_famille_article_id: familleId === '' ? undefined : familleId,
        with_inactif: withInactif,
        q: search.trim() || undefined,
      }),
    enabled: viewMode === 'list',
  })

  const hasActiveFilters = search.trim() !== '' || familleId !== '' || withInactif

  const clearAllFilters = () => {
    setSearch('')
    setFamilleId('')
    setWithInactif(false)
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Catalogue PROLAB' },
      ]}
      moduleBarLabel="Catalogue — PROLAB"
      title="Catalogue produits & essais"
      subtitle={
        viewMode === 'list' && !loadingFlat
          ? `${articlesFlat.length} article(s) — vue liste`
          : 'Vue liste (tarifs, tags, textes, unités HFSQL) ou vue arbre classique.'
      }
      actions={
        isAdmin ? (
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            Création / archivage d’articles : fiche article ou API.
          </span>
        ) : null
      }
    >
      <div className="catalogue-liste">
        <div className="catalogue-liste__view-toggle" role="tablist" aria-label="Mode d’affichage catalogue">
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
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Code, libellé, norme…"
          extra={
            <div className="catalogue-liste__extra-filters">
              <label>
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
              <label className="catalogue-liste__inactif">
                <input type="checkbox" checked={withInactif} onChange={(e) => setWithInactif(e.target.checked)} />
                <span>Inclure inactifs</span>
              </label>
            </div>
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
    </ModuleEntityShell>
  )
}
