import { Link } from 'react-router-dom'
import type { RefArticleRow } from '../../api/client'
import { MONEY_UNIT_LABEL } from '../../lib/appLocale'

type Props = { article: RefArticleRow }

export default function FicheArticle({ article }: Props) {
  const fpkgs = article.famille_packages ?? []
  const params = article.parametres_essai ?? []
  const resultats = article.resultats ?? []

  return (
    <div className="fiche-article">
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
        ID {article.id} — {article.actif ? <strong>Actif</strong> : <strong>Inactif</strong>}
        {typeof article.duree_estimee === 'number' && (
          <> — durée estimée {article.duree_estimee} min</>
        )}
      </p>

      <div
        className="entity-meta-grid"
        style={{ display: 'grid', gap: '0.75rem', maxWidth: 720, marginBottom: '1.5rem' }}
      >
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Code
          </span>
          <div>
            <code>{article.code}</code>
          </div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Libellé
          </span>
          <div>{article.libelle}</div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Famille
          </span>
          <div>{article.famille ? `${article.famille.code} — ${article.famille.libelle}` : '—'}</div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Prix unitaire HT
          </span>
          <div>{article.prix_unitaire_ht_formate ?? `${article.prix_unitaire_ht} €`}</div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            TVA
          </span>
          <div>{article.tva_rate} %</div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Unité
          </span>
          <div>{article.unite || '—'}</div>
        </div>
        {article.normes && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
              Norme(s)
            </span>
            <div>{article.normes}</div>
          </div>
        )}
      </div>

      {article.description && String(article.description).trim() !== '' && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Description
          </h2>
          <p style={{ whiteSpace: 'pre-wrap', margin: '0.5rem 0 0' }}>{article.description}</p>
        </section>
      )}

      {fpkgs.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Catégories de forfaits &amp; packages
          </h2>
          <ul className="list-plain" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
            {fpkgs.map((fp) => (
              <li
                key={fp.id}
                style={{
                  marginBottom: '0.75rem',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: 6,
                  padding: '0.5rem 0.75rem',
                }}
              >
                <strong>{fp.code}</strong> — {fp.libelle}
                {fp.description && <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{fp.description}</p>}
                <ul style={{ margin: '0.35rem 0 0 1rem' }}>
                  {(fp.packages ?? []).map((p) => (
                    <li key={p.id}>
                      <code>{p.code}</code> {p.libelle}
                      {p.description && <span className="text-muted"> — {p.description}</span>}
                      <span className="text-muted">
                        {' '}
                        ({p.prix_ht_formate ?? p.prix_ht} {MONEY_UNIT_LABEL} HT — TVA {p.tva_rate} % —{' '}
                        {p.actif ? 'actif' : 'inactif'})
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(params?.length ?? 0) > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Paramètres d’essai
          </h2>
          <div className="table-wrap">
            <table className="data-table data-table--compact" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ordre</th>
                  <th>Code</th>
                  <th>Libellé</th>
                  <th>Unité</th>
                  <th>Min</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {params!.map((p) => (
                  <tr key={p.id}>
                    <td>{p.ordre}</td>
                    <td>
                      <code>{p.code}</code>
                    </td>
                    <td>{p.libelle}</td>
                    <td>{p.unite ?? '—'}</td>
                    <td>{p.valeur_min ?? '—'}</td>
                    <td>{p.valeur_max ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {resultats.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Résultats attendus
          </h2>
          <div className="table-wrap">
            <table className="data-table data-table--compact" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Libellé</th>
                  <th>Norme</th>
                  <th>Seuil / valeur</th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.code}</code>
                    </td>
                    <td>{r.libelle}</td>
                    <td>{r.norme ?? '—'}</td>
                    <td>{r.valeur_seuil ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/catalogue" className="link-inline">
          ← Retour au catalogue
        </Link>
      </p>
    </div>
  )
}
