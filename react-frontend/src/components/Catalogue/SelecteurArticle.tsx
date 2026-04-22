import { useState } from 'react'
import Modal from '../Modal'
import ArbreCatalogue from './ArbreCatalogue'
import type { RefArticleRow } from '../../api/client'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (article: RefArticleRow) => void
  title?: string
}

/**
 * Modal de sélection d’article (catalogue PROLAB) pour les devis / lignes commerciales.
 */
export default function SelecteurArticle({ isOpen, onClose, onConfirm, title = 'Sélectionner un article' }: Props) {
  const [selected, setSelected] = useState<RefArticleRow | null>(null)

  if (!isOpen) {
    return null
  }

  return (
    <Modal
      title={title}
      onClose={() => {
        setSelected(null)
        onClose()
      }}
    >
      <div className="selecteur-article">
        <p className="selecteur-article__help text-muted">
          Cliquez un article (ligne d’essai) pour le pré-sélectionner, puis validez. Les forfaits (packages) servent
          d’indication : la ligne de devis liée est l’article.
        </p>
        <div className="selecteur-article__tree">
          <ArbreCatalogue
            onSelectArticle={(a) => {
              setSelected(a)
            }}
          />
        </div>
        {selected && (
          <div className="selecteur-article__selected card-panel">
            <div>
              <strong>{selected.code}</strong> — {selected.libelle}
            </div>
            {selected.normes && <div className="text-muted">{selected.normes}</div>}
          </div>
        )}
        <div className="selecteur-article__actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onConfirm(selected)
                setSelected(null)
                onClose()
              }
            }}
          >
            Choisir cet article
          </button>
        </div>
      </div>
    </Modal>
  )
}
