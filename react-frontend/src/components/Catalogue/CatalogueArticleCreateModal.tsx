import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  catalogueApi,
  type RefArticleRow,
  type RefFamilleArticleRow,
  type RefQualificationTagRow,
} from '../../api/client'
import CatalogueMultiPicker, { shortCatalogueOptionLabel } from './CatalogueMultiPicker'
import Modal from '../Modal'

type Props = {
  familleOptions: RefFamilleArticleRow[]
  defaultFamilleId?: number | ''
  onClose: () => void
  onCreated: (article: RefArticleRow) => void
}

export default function CatalogueArticleCreateModal({
  familleOptions,
  defaultFamilleId = '',
  onClose,
  onCreated,
}: Props) {
  const [kind, setKind] = useState<'jalon' | 'product'>('product')
  const [familleId, setFamilleId] = useState(defaultFamilleId === '' ? '' : String(defaultFamilleId))
  const [code, setCode] = useState('')
  const [libelle, setLibelle] = useState('')
  const [familleLabel, setFamilleLabel] = useState('')
  const [codeInterne, setCodeInterne] = useState('')
  const [sku, setSku] = useState('')
  const [unite, setUnite] = useState('U')
  const [prixHt, setPrixHt] = useState('')
  const [tvaRate, setTvaRate] = useState('20')
  const [actif, setActif] = useState(true)
  const [descriptionCommerciale, setDescriptionCommerciale] = useState('')
  const [descriptionTechnique, setDescriptionTechnique] = useState('')
  const [normes, setNormes] = useState('')
  const [qualificationTagIds, setQualificationTagIds] = useState<number[]>([])
  const [productArticleIds, setProductArticleIds] = useState<number[]>([])
  const [jalonArticleIds, setJalonArticleIds] = useState<number[]>([])
  const [productFilter, setProductFilter] = useState('')
  const [jalonFilter, setJalonFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const { data: qualificationTags = [] } = useQuery({
    queryKey: ['catalogue-qualification-tags'],
    queryFn: () => catalogueApi.qualificationTags(),
  })

  const { data: productArticles = [] } = useQuery({
    queryKey: ['catalogue-articles', 'product-pick'],
    queryFn: () => catalogueApi.articles({ kind: 'product', with_inactif: true }),
    enabled: kind === 'jalon',
  })

  const { data: jalonArticles = [] } = useQuery({
    queryKey: ['catalogue-articles', 'jalon-pick'],
    queryFn: () => catalogueApi.articles({ kind: 'jalon', with_inactif: true }),
    enabled: kind === 'product',
  })

  const tagItems = useMemo(
    () =>
      [...qualificationTags]
        .sort((a, b) => a.groupe.localeCompare(b.groupe, 'fr') || a.code.localeCompare(b.code, 'fr'))
        .map((tag: RefQualificationTagRow) => ({
          id: tag.id,
          label: tag.display_label || `${tag.code} — ${tag.label}`,
        })),
    [qualificationTags],
  )

  const productItems = useMemo(
    () =>
      [...productArticles]
        .sort((a, b) => a.code.localeCompare(b.code, 'fr'))
        .map((a) => ({ id: a.id, label: shortCatalogueOptionLabel(a.code, a.libelle) })),
    [productArticles],
  )

  const jalonItems = useMemo(
    () =>
      [...jalonArticles]
        .sort((a, b) => a.code.localeCompare(b.code, 'fr'))
        .map((a) => ({ id: a.id, label: shortCatalogueOptionLabel(a.code, a.libelle) })),
    [jalonArticles],
  )

  const createMut = useMutation({
    mutationFn: () =>
      catalogueApi.createArticle({
        ref_famille_article_id: Number(familleId),
        code: code.trim(),
        libelle: libelle.trim(),
        kind,
        famille_label: kind === 'jalon' ? familleLabel.trim() || undefined : undefined,
        code_interne: codeInterne.trim() || undefined,
        sku: sku.trim() || undefined,
        unite: unite.trim() || 'U',
        prix_unitaire_ht: prixHt.trim() !== '' ? prixHt : undefined,
        tva_rate: tvaRate.trim() !== '' ? tvaRate : '20',
        actif,
        description_commerciale: descriptionCommerciale.trim() || undefined,
        description_technique: descriptionTechnique.trim() || undefined,
        normes: normes.trim() || undefined,
        qualification_tag_ids: kind === 'jalon' && qualificationTagIds.length ? qualificationTagIds : undefined,
        product_article_ids: kind === 'jalon' && productArticleIds.length ? productArticleIds : undefined,
        jalon_article_ids: kind === 'product' && jalonArticleIds.length ? jalonArticleIds : undefined,
      }),
    onSuccess: (article) => {
      if (!article?.id) {
        throw new Error('Réponse serveur invalide : identifiant article manquant.')
      }
      onCreated(article)
    },
  })

  const canSubmit = familleId !== '' && code.trim() !== '' && libelle.trim() !== '' && !createMut.isPending

  return (
    <Modal title="Nouvel article catalogue S2G" onClose={createMut.isPending ? () => {} : onClose}>
      <form
        className="catalogue-article-new-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          createMut.mutate()
        }}
      >
        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Type S2G</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-6">
              Type *
              <select
                value={kind}
                onChange={(e) => {
                  const next = e.target.value
                  if (next === 'jalon' || next === 'product') setKind(next)
                }}
                required
              >
                <option value="product">Produit (descriptif)</option>
                <option value="jalon">Jalon (regroupement)</option>
              </select>
            </label>
            <label className="catalogue-article-new-form__col-6">
              Famille *
              <select value={familleId} onChange={(e) => setFamilleId(e.target.value)} required>
                <option value="">Choisir une famille…</option>
                {familleOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.libelle}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Identité</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-4">
              Code *
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex. D00999" required maxLength={128} />
            </label>
            <label className="catalogue-article-new-form__col-8">
              Libellé *
              <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Intitulé commercial / technique" required />
            </label>
            {kind === 'jalon' && (
              <label className="catalogue-article-new-form__col-12">
                Famille S2G (libellé)
                <input
                  value={familleLabel}
                  onChange={(e) => setFamilleLabel(e.target.value)}
                  placeholder="Ex. Béton, Géotechnique…"
                  maxLength={255}
                />
              </label>
            )}
            <label className="catalogue-article-new-form__col-4">
              Code interne
              <input value={codeInterne} onChange={(e) => setCodeInterne(e.target.value)} maxLength={64} />
            </label>
            <label className="catalogue-article-new-form__col-4">
              SKU
              <input value={sku} onChange={(e) => setSku(e.target.value)} maxLength={64} />
            </label>
            <label className="catalogue-article-new-form__col-4 catalogue-article-new-form__checkbox-field">
              <span>Statut</span>
              <span className="catalogue-article-new-form__checkbox-control">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
                <span>Article actif</span>
              </span>
            </label>
          </div>
        </section>

        {kind === 'jalon' && (
          <section className="catalogue-article-new-form__section">
            <h3 className="catalogue-article-new-form__section-title">Qualification & produits liés</h3>
            <div className="catalogue-article-new-form__grid">
              <div className="catalogue-article-new-form__col-6 catalogue-article-new-form__field">
                <span className="catalogue-article-new-form__field-label">Tags de qualification (0 ou plusieurs)</span>
                <CatalogueMultiPicker
                  items={tagItems}
                  selectedIds={qualificationTagIds}
                  onChange={setQualificationTagIds}
                  filter={tagFilter}
                  onFilterChange={setTagFilter}
                  emptyLabel="Aucun tag ne correspond au filtre."
                />
              </div>
              <div className="catalogue-article-new-form__col-6 catalogue-article-new-form__field">
                <span className="catalogue-article-new-form__field-label">Produits rattachés (0 ou plusieurs)</span>
                <CatalogueMultiPicker
                  items={productItems}
                  selectedIds={productArticleIds}
                  onChange={setProductArticleIds}
                  filter={productFilter}
                  onFilterChange={setProductFilter}
                  emptyLabel="Aucun produit ne correspond au filtre."
                />
              </div>
            </div>
          </section>
        )}

        {kind === 'product' && (
          <section className="catalogue-article-new-form__section">
            <h3 className="catalogue-article-new-form__section-title">Jalons liés</h3>
            <div className="catalogue-article-new-form__grid">
              <div className="catalogue-article-new-form__col-12 catalogue-article-new-form__field">
                <span className="catalogue-article-new-form__field-label">Jalons (0 ou plusieurs)</span>
                <CatalogueMultiPicker
                  items={jalonItems}
                  selectedIds={jalonArticleIds}
                  onChange={setJalonArticleIds}
                  filter={jalonFilter}
                  onFilterChange={setJalonFilter}
                  emptyLabel="Aucun jalon ne correspond au filtre."
                />
              </div>
            </div>
          </section>
        )}

        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Tarification & unités</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-4">
              Unité
              <input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="U, m², forfait…" maxLength={32} />
            </label>
            <label className="catalogue-article-new-form__col-4">
              Prix unitaire HT
              <input type="number" min={0} step="0.01" value={prixHt} onChange={(e) => setPrixHt(e.target.value)} placeholder="0.00" />
            </label>
            <label className="catalogue-article-new-form__col-4">
              TVA (%)
              <input type="number" min={0} max={100} step="0.01" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Descriptions & normes</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-12">
              Description commerciale
              <textarea rows={3} value={descriptionCommerciale} onChange={(e) => setDescriptionCommerciale(e.target.value)} />
            </label>
            <label className="catalogue-article-new-form__col-12">
              Description technique
              <textarea rows={4} value={descriptionTechnique} onChange={(e) => setDescriptionTechnique(e.target.value)} />
            </label>
            <label className="catalogue-article-new-form__col-12">
              Normes
              <input value={normes} onChange={(e) => setNormes(e.target.value)} />
            </label>
          </div>
        </section>

        {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
        <div className="crud-actions catalogue-article-new-form__actions">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {createMut.isPending ? 'Création…' : kind === 'jalon' ? 'Créer le jalon' : 'Créer le produit'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={createMut.isPending} onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  )
}
