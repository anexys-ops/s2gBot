import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { catalogueApi, type RefArticleRow, type RefFamilleArticleRow } from '../../api/client'
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
  const [familleId, setFamilleId] = useState(defaultFamilleId === '' ? '' : String(defaultFamilleId))
  const [code, setCode] = useState('')
  const [libelle, setLibelle] = useState('')
  const [unite, setUnite] = useState('U')
  const [prixHt, setPrixHt] = useState('')
  const [tvaRate, setTvaRate] = useState('20')

  const createMut = useMutation({
    mutationFn: () =>
      catalogueApi.createArticle({
        ref_famille_article_id: Number(familleId),
        code: code.trim(),
        libelle: libelle.trim(),
        unite: unite.trim() || undefined,
        prix_unitaire_ht: prixHt.trim() !== '' ? prixHt : undefined,
        tva_rate: tvaRate.trim() !== '' ? tvaRate : '20',
        actif: true,
      }),
    onSuccess: (article) => onCreated(article),
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
        <p className="text-muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Créez un article PROLAB. Les détails (descriptions, normes, tags…) sont modifiables ensuite sur la fiche.
        </p>
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
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex. BETON-FC28"
              required
              maxLength={128}
            />
          </label>
          <label className="catalogue-article-new-form__col-8">
            Libellé *
            <input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Intitulé commercial / technique"
              required
              maxLength={255}
            />
          </label>
          <label className="catalogue-article-new-form__col-4">
            Unité
            <input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="U, m², forfait…" maxLength={32} />
          </label>
          <label className="catalogue-article-new-form__col-4">
            Prix unitaire HT
            <input
              type="number"
              min={0}
              step="0.01"
              value={prixHt}
              onChange={(e) => setPrixHt(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="catalogue-article-new-form__col-4">
            TVA (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={tvaRate}
              onChange={(e) => setTvaRate(e.target.value)}
            />
          </label>
        </div>
        {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
        <div className="crud-actions" style={{ marginTop: '1rem' }}>
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
