import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { catalogueApi, type RefArticleRow, type RefFamilleArticleRow } from '../../api/client'
import Modal from '../Modal'

type Props = {
  familleOptions: RefFamilleArticleRow[]
  defaultFamilleId?: number | ''
  onClose: () => void
  onCreated: (article: RefArticleRow) => void
}

function shortOptionLabel(code: string, label: string, max = 60) {
  const text = `${code} — ${label}`
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export default function CatalogueArticleCreateModal({
  familleOptions,
  defaultFamilleId = '',
  onClose,
  onCreated,
}: Props) {
  const [familleId, setFamilleId] = useState(defaultFamilleId === '' ? '' : String(defaultFamilleId))
  const [code, setCode] = useState('')
  const [libelle, setLibelle] = useState('')
  const [codeInterne, setCodeInterne] = useState('')
  const [sku, setSku] = useState('')
  const [unite, setUnite] = useState('U')
  const [hfsqlUnite, setHfsqlUnite] = useState('')
  const [refArticleLieId, setRefArticleLieId] = useState('')
  const [tags, setTags] = useState('')
  const [prixHt, setPrixHt] = useState('')
  const [prixRevientHt, setPrixRevientHt] = useState('')
  const [tvaRate, setTvaRate] = useState('20')
  const [dureeEstimee, setDureeEstimee] = useState('0')
  const [actif, setActif] = useState(true)
  const [description, setDescription] = useState('')
  const [descriptionCommerciale, setDescriptionCommerciale] = useState('')
  const [descriptionTechnique, setDescriptionTechnique] = useState('')
  const [normes, setNormes] = useState('')

  const { data: articlesLiePick = [] } = useQuery({
    queryKey: ['catalogue-articles', 'lie-pick'],
    queryFn: () => catalogueApi.articles({ with_inactif: true }),
  })

  const lieOptions = useMemo(
    () => [...articlesLiePick].sort((a, b) => a.code.localeCompare(b.code, 'fr')),
    [articlesLiePick],
  )

  const createMut = useMutation({
    mutationFn: () => {
      const tagList = tags
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      return catalogueApi.createArticle({
        ref_famille_article_id: Number(familleId),
        code: code.trim(),
        libelle: libelle.trim(),
        code_interne: codeInterne.trim() || undefined,
        sku: sku.trim() || undefined,
        unite: unite.trim() || undefined,
        hfsql_unite: hfsqlUnite.trim() || undefined,
        ref_article_lie_id: refArticleLieId ? Number(refArticleLieId) : undefined,
        tags: tagList.length ? tagList : undefined,
        prix_unitaire_ht: prixHt.trim() !== '' ? prixHt : undefined,
        prix_revient_ht: prixRevientHt.trim() !== '' ? prixRevientHt : undefined,
        tva_rate: tvaRate.trim() !== '' ? tvaRate : '20',
        duree_estimee: dureeEstimee.trim() !== '' ? Number(dureeEstimee) : 0,
        actif,
        description: description.trim() || undefined,
        description_commerciale: descriptionCommerciale.trim() || undefined,
        description_technique: descriptionTechnique.trim() || undefined,
        normes: normes.trim() || undefined,
      })
    },
    onSuccess: (article) => {
      if (!article?.id) {
        throw new Error('Réponse serveur invalide : identifiant article manquant.')
      }
      onCreated(article)
    },
  })

  const canSubmit =
    familleId !== '' &&
    code.trim() !== '' &&
    libelle.trim() !== '' &&
    !createMut.isPending

  return (
    <Modal title="Nouvel article catalogue" onClose={createMut.isPending ? () => {} : onClose}>
      <form
        className="catalogue-article-new-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          createMut.mutate()
        }}
      >
        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Identité</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-12">
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
            <label className="catalogue-article-new-form__col-4">
              Code *
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex. BETON-FC28" required maxLength={128} />
            </label>
            <label className="catalogue-article-new-form__col-8">
              Libellé *
              <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Intitulé commercial / technique" required maxLength={255} />
            </label>
            <label className="catalogue-article-new-form__col-4">
              Code interne
              <input value={codeInterne} onChange={(e) => setCodeInterne(e.target.value)} placeholder="Réf. interne labo" maxLength={64} />
            </label>
            <label className="catalogue-article-new-form__col-4">
              SKU
              <input value={sku} onChange={(e) => setSku(e.target.value)} maxLength={64} />
            </label>
            <label className="catalogue-article-new-form__col-4">
              Regroupement
              <select value={refArticleLieId} onChange={(e) => setRefArticleLieId(e.target.value)}>
                <option value="">— Aucun —</option>
                {lieOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {shortOptionLabel(a.code, a.libelle)}
                  </option>
                ))}
              </select>
            </label>
            <label className="catalogue-article-new-form__col-12">
              Tags (séparés par virgules)
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Béton, Urgent, Dalle…" />
            </label>
          </div>
        </section>

        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Tarification & unités</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-4">
              Unité (cotation)
              <input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="U, m², forfait…" maxLength={32} />
            </label>
            <label className="catalogue-article-new-form__col-4">
              Unité HFSQL
              <input value={hfsqlUnite} onChange={(e) => setHfsqlUnite(e.target.value)} placeholder="ex. m³, u, h" maxLength={64} />
            </label>
            <label className="catalogue-article-new-form__col-4">
              Durée estimée (min)
              <input type="number" min={0} value={dureeEstimee} onChange={(e) => setDureeEstimee(e.target.value)} />
            </label>
            <label className="catalogue-article-new-form__col-3">
              Prix unitaire HT
              <input type="number" min={0} step="0.01" value={prixHt} onChange={(e) => setPrixHt(e.target.value)} placeholder="0.00" />
            </label>
            <label className="catalogue-article-new-form__col-3">
              Prix de revient HT
              <input type="number" min={0} step="0.01" value={prixRevientHt} onChange={(e) => setPrixRevientHt(e.target.value)} placeholder="0.00" />
            </label>
            <label className="catalogue-article-new-form__col-3">
              TVA (%)
              <input type="number" min={0} max={100} step="0.01" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} />
            </label>
            <label className="catalogue-article-new-form__col-3 catalogue-article-new-form__checkbox-field">
              <span>Statut</span>
              <span className="catalogue-article-new-form__checkbox-control">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
                <span>Article actif</span>
              </span>
            </label>
          </div>
        </section>

        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Descriptions & normes</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-12">
              Description (legacy)
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
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
            {createMut.isPending ? 'Création…' : 'Créer l’article'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={createMut.isPending} onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  )
}
