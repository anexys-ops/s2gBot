import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import { catalogueApi, type RefArticleRow } from '../../api/client'
import { formatMoney } from '../../lib/appLocale'

type Props = {
  onClose: () => void
  onPick: (article: RefArticleRow) => void
}

type PickerRow = RefArticleRow & { pickerKind: 'jalon' | 'product' }

export default function S2gCataloguePickerModal({ onClose, onPick }: Props) {
  const [search, setSearch] = useState('')

  const { data: jalons = [], isLoading: loadingJalons } = useQuery({
    queryKey: ['catalogue', 's2g', 'jalon'],
    queryFn: () => catalogueApi.articles({ kind: 'jalon' }),
  })

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['catalogue', 's2g', 'product'],
    queryFn: () => catalogueApi.articles({ kind: 'product' }),
  })

  const rows = useMemo<PickerRow[]>(() => {
    const merged: PickerRow[] = [
      ...jalons.map((a) => ({ ...a, pickerKind: 'jalon' as const })),
      ...products.map((a) => ({ ...a, pickerKind: 'product' as const })),
    ]
    const q = search.trim().toLowerCase()
    if (!q) return merged.sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
    return merged
      .filter(
        (a) =>
          a.libelle.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          (a.code_interne ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
  }, [jalons, products, search])

  const loading = loadingJalons || loadingProducts

  return (
    <Modal title="Catalogue S2G" onClose={onClose}>
      <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
        Choisissez un <strong>jalon</strong> (avec ses produits Actions &amp; matériel) ou un{' '}
        <strong>produit</strong> seul.
      </p>
      <input
        type="search"
        placeholder="Rechercher par libellé ou code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: '0.75rem' }}
        autoFocus
      />
      {loading ? (
        <p>Chargement du catalogue…</p>
      ) : (
        <div className="catalog-picker-list">
          {rows.map((a) => (
            <button
              key={`${a.pickerKind}-${a.id}`}
              type="button"
              className="catalog-picker-row"
              onClick={() => onPick(a)}
            >
              <span className="catalog-picker-row__name">
                <span
                  className={`status-pill ${a.pickerKind === 'jalon' ? 'status-pill--emerald' : 'status-pill--teal'}`}
                  style={{ fontSize: '0.7rem', marginRight: '0.5rem' }}
                >
                  {a.pickerKind === 'jalon' ? 'Jalon' : 'Produit'}
                </span>
                {a.libelle}
              </span>
              <span className="catalog-picker-row__meta">
                {a.code}
                {a.pickerKind === 'product'
                  ? ` · ${formatMoney(Number(a.prix_unitaire_ht))} (HT) · TVA ${Number(a.tva_rate).toFixed(0)} %`
                  : ''}
              </span>
            </button>
          ))}
          {rows.length === 0 && (
            <p className="text-muted">Aucun jalon ou produit S2G actif. Créez-les dans le catalogue.</p>
          )}
        </div>
      )}
    </Modal>
  )
}
