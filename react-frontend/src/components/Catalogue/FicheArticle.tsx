import { Link } from 'react-router-dom'
import type { RefArticleRow } from '../../api/client'
import { formatMoney } from '../../lib/appLocale'
import { formatOptionalNumber, formatRefArticlePrice, formatTvaPercent } from '../../lib/catalogueFormat'

type ArticleFicheSection = 'all' | 'overview' | 'descriptions' | 'tables'

type Props = { article: RefArticleRow; section?: ArticleFicheSection; showBackLink?: boolean }

function truncateLabel(value: string, max = 60) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export default function FicheArticle({ article, section = 'all', showBackLink = true }: Props) {
  const fpkgs = article.famille_packages ?? []
  const params = article.parametres_essai ?? []
  const resultats = article.resultats ?? []
  const prixHt = formatRefArticlePrice(article)
  const showOverview = section === 'all' || section === 'overview'
  const showDescriptions = section === 'all' || section === 'descriptions'
  const showTables = section === 'all' || section === 'tables'

  return (
    <div className="fiche-article">
      {showOverview && <div className="fiche-article__summary card">
        <h2 className="fiche-article__summary-title">Caractéristiques</h2>
        {article.tags && article.tags.length > 0 && (
          <div className="fiche-article__tags">
            {article.tags.map((t, i) => (
              <span key={i} className="catalogue-prolab-tag catalogue-prolab-tag--a">
                {t}
              </span>
            ))}
          </div>
        )}
        <dl className="module-fiche-grid fiche-article__dl">
          <div>
            <dt>Code article</dt>
            <dd>
              <code className="fiche-article__code">{article.code}</code>
            </dd>
          </div>
          <div>
            <dt>Code interne</dt>
            <dd>{article.code_interne?.trim() || '—'}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>{article.sku?.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Libellé</dt>
            <dd>{article.libelle || '—'}</dd>
          </div>
          <div>
            <dt>Famille</dt>
            <dd>
              {article.famille ? (
                <>
                  <span className="fiche-article__family-code">{article.famille.code}</span>
                  <span className="text-muted"> — {article.famille.libelle}</span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Prix unitaire HT</dt>
            <dd className="fiche-article__amount">{prixHt}</dd>
          </div>
          <div>
            <dt>Prix de revient HT</dt>
            <dd>
              {article.prix_revient_ht != null && String(article.prix_revient_ht).trim() !== '' && Number(article.prix_revient_ht) > 0
                ? formatMoney(Number(article.prix_revient_ht))
                : '—'}
            </dd>
          </div>
          <div>
            <dt>TVA</dt>
            <dd>{formatTvaPercent(article.tva_rate)}</dd>
          </div>
          <div>
            <dt>Unité (cotation / devis)</dt>
            <dd>{article.unite?.trim() ? article.unite : '—'}</dd>
          </div>
          <div>
            <dt>Unité HFSQL (import)</dt>
            <dd>
              {article.hfsql_unite?.trim() || (
                <span className="text-muted">Identique ou non renseigné</span>
              )}
            </dd>
          </div>
          {article.article_lie && (
            <div>
              <dt>Regroupement (autre article)</dt>
              <dd>
                <Link to={`/catalogue/articles/${article.article_lie.id}`} className="link-inline">
                  <span title={`${article.article_lie.code} — ${article.article_lie.libelle}`}>
                    {article.article_lie.code} — {truncateLabel(article.article_lie.libelle, 60)}
                  </span>
                </Link>
              </dd>
            </div>
          )}
          {typeof article.duree_estimee === 'number' && article.duree_estimee > 0 && (
            <div>
              <dt>Durée estimée</dt>
              <dd>{article.duree_estimee} min</dd>
            </div>
          )}
        </dl>
        <p className="fiche-article__id-line text-muted">
          Réf. interne #{article.id} — {article.actif ? <span className="status-pill status-pill--ok">Actif</span> : <span className="status-pill status-pill--muted">Inactif</span>}
        </p>
        {article.normes && String(article.normes).trim() !== '' && (
          <div className="fiche-article__normes">
            <h3 className="fiche-article__h3">Norme(s)</h3>
            <p className="fiche-article__normes-text">{article.normes}</p>
          </div>
        )}
      </div>}

      {showDescriptions && ((article.description_commerciale && article.description_commerciale.trim()) ||
        (article.description && String(article.description).trim())) && (
        <section className="fiche-article__section card">
          <h2 className="fiche-article__h2">Description commerciale</h2>
          <p className="fiche-article__body">
            {(article.description_commerciale && article.description_commerciale.trim()) || article.description}
          </p>
        </section>
      )}
      {showDescriptions && article.description_technique && String(article.description_technique).trim() !== '' && (
        <section className="fiche-article__section card">
          <h2 className="fiche-article__h2">Description technique</h2>
          <p className="fiche-article__body fiche-article__body--tech">{article.description_technique}</p>
        </section>
      )}

      {showTables && fpkgs.length > 0 && (
        <section className="fiche-article__section card">
          <h2 className="fiche-article__h2">Forfaits &amp; packages</h2>
          <ul className="fiche-article__forfait-list">
            {fpkgs.map((fp) => (
              <li key={fp.id} className="fiche-article__forfait">
                <div className="fiche-article__forfait-head">
                  <strong>{fp.code}</strong>
                  <span className="text-muted"> — {fp.libelle}</span>
                </div>
                {fp.description && <p className="fiche-article__forfait-desc text-muted">{fp.description}</p>}
                <ul className="fiche-article__pkg-list">
                  {(fp.packages ?? []).map((p) => {
                    const px =
                      p.prix_ht_formate && String(p.prix_ht_formate).trim() !== ''
                        ? p.prix_ht_formate
                        : p.prix_ht != null && Number.isFinite(Number(p.prix_ht))
                          ? formatMoney(Number(p.prix_ht))
                          : '—'
                    return (
                      <li key={p.id}>
                        <code>{p.code}</code> {p.libelle}
                        {p.description && <span className="text-muted"> — {p.description}</span>}
                        <span className="text-muted fiche-article__pkg-meta">
                          {' '}
                          · {px} HT · TVA {formatTvaPercent(p.tva_rate)} · {p.actif ? 'actif' : 'inactif'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showTables && params.length > 0 && (
        <section className="fiche-article__section card">
          <h2 className="fiche-article__h2">Paramètres d’essai</h2>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
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
                {params.map((p) => (
                  <tr key={p.id}>
                    <td>{p.ordre}</td>
                    <td>
                      <code>{p.code}</code>
                    </td>
                    <td>{p.libelle}</td>
                    <td>{p.unite ?? '—'}</td>
                    <td>{formatOptionalNumber(p.valeur_min)}</td>
                    <td>{formatOptionalNumber(p.valeur_max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showTables && resultats.length > 0 && (
        <section className="fiche-article__section card">
          <h2 className="fiche-article__h2">Résultats attendus</h2>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
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

      {showBackLink && <p className="fiche-article__back">
        <Link to="/catalogue" className="btn btn-secondary btn-sm">
          ← Retour au catalogue
        </Link>
      </p>}
    </div>
  )
}
