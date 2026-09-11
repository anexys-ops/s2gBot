import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogueApi, type RefArticleKind } from '../../api/client'
import CatalogueProlabTable from '../Catalogue/CatalogueProlabTable'
import CatalogueArticleCreateModal from '../Catalogue/CatalogueArticleCreateModal'
import ListTableToolbar from '../ListTableToolbar'
import { useAuth } from '../../contexts/AuthContext'
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility'

/**
 * Liste catalogue S2G (jalons & produits) dans Configuration — vision admin complète + CRUD.
 */
export default function ConfigCatalogueProductsPanel() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [articleKind, setArticleKind] = useState<RefArticleKind | ''>('')
  const [withInactif, setWithInactif] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { visible, toggle } = usePersistedColumnVisibility('config-catalogue-articles', {
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

  const { data: familles = [] } = useQuery({
    queryKey: ['catalogue-familles', withInactif],
    queryFn: () => catalogueApi.familles({ with_inactif: withInactif }),
  })

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['config-catalogue-articles', search, articleKind, withInactif],
    queryFn: () =>
      catalogueApi.articles({
        q: search.trim() || undefined,
        kind: articleKind === '' ? undefined : articleKind,
        with_inactif: withInactif,
      }),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['config-catalogue-articles'] })
    void queryClient.invalidateQueries({ queryKey: ['catalogue-articles-flat'] })
    void queryClient.invalidateQueries({ queryKey: ['catalogue'] })
  }

  return (
    <div className="config-catalogue-products">
      <p style={{ color: 'var(--color-muted)', maxWidth: '78ch', lineHeight: 1.5, marginTop: 0 }}>
        Référentiel S2G complet (jalons et produits) : recherche, filtres, création et accès aux fiches pour modifier
        ou supprimer. Pour l’arborescence familles et les vues avancées, ouvrez le{' '}
        <Link to="/catalogue">catalogue principal</Link>.
      </p>

      <div className="config-catalogue-products__toolbar">
        {isAdmin ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            Nouveau article
          </button>
        ) : null}
        <Link to="/catalogue" className="btn btn-secondary btn-sm">
          Catalogue complet
        </Link>
      </div>

      <ListTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Code, libellé…"
        columns={[
          { id: 'kind', label: 'Type' },
          { id: 'code', label: 'Code' },
          { id: 'libelle', label: 'Libellé' },
          { id: 'famille', label: 'Famille' },
          { id: 'unite', label: 'Unité' },
          { id: 'prix', label: 'PU HT' },
          { id: 'tva', label: 'TVA' },
          { id: 'statut', label: 'Statut' },
          { id: 'actions', label: 'Actions' },
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
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
          <span className="text-muted">
            {isLoading ? 'Chargement…' : `${articles.length} article(s) S2G`}
          </span>
        }
      />

      <CatalogueProlabTable articles={articles} isLoading={isLoading} visibleColumns={visible} />

      {isAdmin && articles.length > 0 ? (
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
          Suppression rapide : ouvrez la fiche puis « Supprimer », ou utilisez le bouton ci-dessous sur une ligne
          sélectionnée dans le catalogue complet.
        </p>
      ) : null}

      {showCreateModal && isAdmin ? (
        <CatalogueArticleCreateModal
          familleOptions={familles}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            invalidate()
          }}
        />
      ) : null}
    </div>
  )
}
