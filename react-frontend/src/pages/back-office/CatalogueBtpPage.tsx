import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ArbreCatalogue from '../../components/Catalogue/ArbreCatalogue'
import SelecteurArticle from '../../components/Catalogue/SelecteurArticle'
import type { RefArticleRow } from '../../api/client'

/**
 * Aperçu du référentiel catalogue (PROLAB) et test du sélecteur pour devis.
 */
export default function CatalogueBtpPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [picker, setPicker] = useState(false)
  const [lastPick, setLastPick] = useState<RefArticleRow | null>(null)

  return (
    <div>
      <div className="back-office-btp__toolbar" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {isLab && (
          <button type="button" className="btn btn-primary" onClick={() => setPicker(true)}>
            Ouvrir le sélecteur (démos devis)
          </button>
        )}
        {lastPick && (
          <span className="text-muted" style={{ alignSelf: 'center' }}>
            Dernier choix : <strong>{lastPick.code}</strong> — {lastPick.libelle}
          </span>
        )}
      </div>
      <h2 className="h2" style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
        Arbre Famille → Article → Package
      </h2>
      <ArbreCatalogue
        onSelectArticle={(a) => {
          setLastPick(a)
        }}
      />
      {isLab && (
        <SelecteurArticle
          isOpen={picker}
          onClose={() => setPicker(false)}
          onConfirm={(a) => setLastPick(a)}
        />
      )}
    </div>
  )
}
