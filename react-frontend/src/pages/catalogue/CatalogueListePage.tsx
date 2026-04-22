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
      <div
        className="card catalogue-liste__toolbar"
        style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-end',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Famille
          </span>
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
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px' }}>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Recherche (code / libellé)
          </span>
          <input
            type="search"
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex. BETON, FC28, compactage…"
          />
        </label>
        <label
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
        >
          <input type="checkbox" checked={withInactif} onChange={(e) => setWithInactif(e.target.checked)} />
          <span style={{ fontSize: '0.9rem' }}>Inclure inactifs</span>
        </label>
      </div>

      <p className="catalogue-liste__legend text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
        <span aria-hidden>🧱</span> Béton &nbsp;
        <span aria-hidden>⚙️</span> Sols / compactage &nbsp;
        <span aria-hidden>📐</span> Produits manufacturés
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
