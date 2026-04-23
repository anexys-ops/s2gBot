import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { RefArticleRow } from '../../api/client'
import { formatMoney } from '../../lib/appLocale'
import { formatRefArticlePrice, formatTvaPercent } from '../../lib/catalogueFormat'

function tagTone(i: number): string {
  const tones = ['catalogue-prolab-tag--a', 'catalogue-prolab-tag--b', 'catalogue-prolab-tag--c', 'catalogue-prolab-tag--d']
  return tones[i % tones.length]
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type Props = {
  articles: RefArticleRow[]
  isLoading?: boolean
}

/**
 * Liste produits PROLAB : résumé + replis (détails commerciaux / techniques, tarifs, codes, lien).
 */
export default function CatalogueProlabListe({ articles, isLoading }: Props) {
  const sorted = useMemo(() => {
    return [...articles].sort((a, b) => {
      const oa = a.famille?.ordre ?? 999
      const ob = b.famille?.ordre ?? 999
      if (oa !== ob) return oa - ob
      const fc = (a.famille?.code ?? '').localeCompare(b.famille?.code ?? '', 'fr')
      if (fc !== 0) return fc
      return a.code.localeCompare(b.code, 'fr', { sensitivity: 'base' })
    })
  }, [articles])

  if (isLoading) {
    return <p className="text-muted">Chargement des articles…</p>
  }

  if (sorted.length === 0) {
    return <p className="text-muted catalogue-prolab-liste__empty">Aucun article ne correspond aux filtres.</p>
  }

  return (
    <div className="catalogue-prolab-liste">
      <p className="catalogue-prolab-liste__hint text-muted" role="note">
        Chaque produit est repliable : codes, unités (s2g + réf. HFSQL), prix public / revient, textes, lien de
        regroupement, tags.
      </p>
      <ul className="catalogue-prolab-liste__ul">
        {sorted.map((a) => {
          const tags = a.tags?.filter((t) => t.trim()) ?? []
          const pxVente = formatRefArticlePrice(a)
          const pr = a.prix_revient_ht
          const prNum = pr != null && String(pr).trim() !== '' ? num(pr) : null
          return (
            <li key={a.id} className="catalogue-prolab-card">
              <details className="catalogue-prolab-card__details">
                <summary className="catalogue-prolab-card__summary">
                  <div className="catalogue-prolab-card__row1">
                    <span className="catalogue-prolab-card__fam" title="Catégorie (famille)">
                      {a.famille ? (
                        <>
                          <span className="catalogue-prolab-card__fam-code">{a.famille.code}</span>
                          <span className="text-muted"> {a.famille.libelle}</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </span>
                    {!a.actif && <span className="status-pill status-pill--muted">Inactif</span>}
                    {tags.map((t, i) => (
                      <span key={`${a.id}-t-${i}`} className={`catalogue-prolab-tag ${tagTone(i)}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="catalogue-prolab-card__row2">
                    <code className="catalogue-prolab-card__code">{a.code}</code>
                    <strong className="catalogue-prolab-card__title">{a.libelle}</strong>
                  </div>
                  <div className="catalogue-prolab-card__row3">
                    <span className="catalogue-prolab-card__price">
                      <span className="text-muted">PU HT</span> {pxVente}
                    </span>
                    {prNum != null && prNum > 0 && (
                      <span className="catalogue-prolab-card__revient">
                        <span className="text-muted">Revient</span> {formatMoney(prNum)}
                      </span>
                    )}
                    <span className="catalogue-prolab-card__tva text-muted">TVA {formatTvaPercent(a.tva_rate)}</span>
                    <Link to={`/catalogue/articles/${a.id}`} className="catalogue-prolab-card__fiche" onClick={(e) => e.stopPropagation()}>
                      Fiche →
                    </Link>
                  </div>
                </summary>
                <div className="catalogue-prolab-card__body">
                  <dl className="catalogue-prolab-dl">
                    <div>
                      <dt>Code interne</dt>
                      <dd>{a.code_interne?.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt>SKU</dt>
                      <dd>{a.sku?.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt>Unité (cotation)</dt>
                      <dd>{a.unite?.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt>Unité HFSQL (import)</dt>
                      <dd>
                        {a.hfsql_unite?.trim() || (
                          <span className="text-muted">{a.unite?.trim() ? 'Identique à l’unité cotation' : '—'}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Regroupement</dt>
                      <dd>
                        {a.article_lie ? (
                          <Link to={`/catalogue/articles/${a.article_lie.id}`} className="link-inline">
                            {a.article_lie.code} — {a.article_lie.libelle}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                  {(a.description_commerciale?.trim() ||
                    a.description?.trim() ||
                    a.description_technique?.trim()) && (
                    <div className="catalogue-prolab-texts">
                      {((a.description_commerciale && a.description_commerciale.trim()) || (a.description && a.description.trim())) && (
                        <div className="catalogue-prolab-block">
                          <h4 className="catalogue-prolab-block__h">Présentation / description commerciale</h4>
                          <p className="catalogue-prolab-block__p">
                            {(a.description_commerciale && a.description_commerciale.trim()) || a.description}
                          </p>
                        </div>
                      )}
                      {a.description_technique?.trim() && (
                        <div className="catalogue-prolab-block">
                          <h4 className="catalogue-prolab-block__h">Description technique</h4>
                          <p className="catalogue-prolab-block__p catalogue-prolab-block__p--tech">{a.description_technique}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {a.normes && String(a.normes).trim() !== '' && (
                    <p className="catalogue-prolab-normes">
                      <strong>Normes :</strong> {a.normes}
                    </p>
                  )}
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
