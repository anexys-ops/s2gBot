import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { catalogueApi, type RefFamilleArticleRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ArbreCatalogue from '../../components/Catalogue/ArbreCatalogue'
import CatalogueProlabListe from '../../components/Catalogue/CatalogueProlabListe'
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

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Catalogue PROLAB' },
      ]}
      moduleBarLabel="Catalogue — PROLAB"
      title="Catalogue produits & essais"
      subtitle="Vue liste (tarifs, tags, textes, unités HFSQL) ou vue arbre classique. Données alignées import PROLAB / HFSQL."
      actions={
        isAdmin ? (
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            Création / archivage d’articles : fiche article ou API.
          </span>
        ) : null
      }
    >
      <div className="catalogue-liste__view-toggle" role="tablist" aria-label="Mode d’affichage catalogue">
        <button
          type="button"
          role="tab"
          className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setViewMode('list')}
        >
          Liste &amp; replis
        </button>
        <button
          type="button"
          role="tab"
          className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setViewMode('tree')}
        >
          Vue arbre
        </button>
      </div>
      <div className="card catalogue-liste__toolbar list-filter-row">
        <label className="catalogue-liste__field">
          <span className="catalogue-liste__label">Famille</span>
          <select
            className="form-control"
            value={familleId === '' ? '' : String(familleId)}
            onChange={(e) => setFamilleId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Toutes</option>
            {familleOptions.map((f: RefFamilleArticleRow) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.libelle}
              </option>
            ))}
          </select>
        </label>
        {familleOptions.length > 0 && (
          <div className="catalogue-liste__chips" aria-label="Familles" style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
            flexBasis: '100%', marginTop: '0.5rem',
          }}>
            <button
              type="button"
              className="btn btn-sm"
              aria-pressed={familleId === ''}
              onClick={() => setFamilleId('')}
              style={{
                background: familleId === '' ? '#111827' : '#f3f4f6',
                color: familleId === '' ? '#fff' : '#374151',
                border: '1px solid #e5e7eb', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.78rem',
              }}
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
                  aria-pressed={active}
                  onClick={() => setFamilleId(f.id)}
                  title={f.type_ressource ? `Ressource : ${f.type_ressource}` : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    background: active ? dot : '#fff',
                    color: active ? '#fff' : '#374151',
                    border: `1px solid ${active ? dot : '#e5e7eb'}`,
                    borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: active ? '#fff' : dot, display: 'inline-block',
                  }} />
                  {f.libelle}
                </button>
              )
            })}
          </div>
        )}
        <label className="catalogue-liste__field catalogue-liste__field--search">
          <span className="catalogue-liste__label">Recherche (code / libellé)</span>
          <input
            type="search"
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex. BETON, FC28, compactage…"
          />
        </label>
        <label className="catalogue-liste__checkbox">
          <input type="checkbox" checked={withInactif} onChange={(e) => setWithInactif(e.target.checked)} />
          <span>Inclure inactifs</span>
        </label>
      </div>

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
    </ModuleEntityShell>
  )
}
