import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { catalogueApi, type RefFamilleArticleRow } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ArbreCatalogue from '../../components/Catalogue/ArbreCatalogue'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

/**
 * BDC-111 — Liste catalogue PROLAB (arbre + filtres).
 */
export default function CatalogueListePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const [familleId, setFamilleId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [withInactif, setWithInactif] = useState(false)

  const { data: familles } = useQuery({
    queryKey: ['catalogue-familles', withInactif],
    queryFn: () => catalogueApi.familles({ with_inactif: withInactif }),
  })

  const familleOptions = useMemo(() => familles ?? [], [familles])

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Catalogue PROLAB' },
      ]}
      moduleBarLabel="Catalogue — PROLAB"
      title="Catalogue produits & essais"
      subtitle="Famille d’articles → article → forfaits (packages). Données alignées sur la migration PROLAB."
      actions={
        isAdmin ? (
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            Création / archivage d’articles : API admin ou prochain écran dédié.
          </span>
        ) : null
      }
    >
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
    </ModuleEntityShell>
  )
}
