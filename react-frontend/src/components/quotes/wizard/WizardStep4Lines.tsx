import { useMemo, useState } from 'react'
import ConfirmDialog from '../../ConfirmDialog'
import type { QuoteFormState, QuoteLineDraft } from '../QuoteFormFields'
import { lineHt } from '../../../lib/quoteTotals'
import { formatMoney, MONEY_UNIT_LABEL } from '../../../lib/appLocale'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  addLine: () => void
  updateLine: (index: number, field: keyof QuoteLineDraft, value: string | number | null | boolean) => void
  removeLine: (index: number) => void
  onOpenCommercialCatalog: (lineIndex: number) => void
  onOpenProlabCatalog: (lineIndex: number) => void
  onAddFromCommercialCatalog?: () => void
  onAddFromProlabCatalog?: () => void
}

function lineOrigin(l: QuoteLineDraft): string {
  if (l.commercial_offering_id) return 'Offre'
  if (l.ref_article_id) return 'PROLAB'
  if (l.ref_package_id) return 'Forfait'
  return 'Libre'
}

function lineOriginTone(l: QuoteLineDraft): string {
  if (l.commercial_offering_id) return 'status-pill--coral'
  if (l.ref_article_id) return 'status-pill--emerald'
  if (l.ref_package_id) return 'status-pill--amber'
  return 'status-pill--slate'
}

export default function WizardStep4Lines({
  form,
  setForm,
  addLine,
  updateLine,
  removeLine,
  onOpenCommercialCatalog,
  onOpenProlabCatalog,
  onAddFromCommercialCatalog,
  onAddFromProlabCatalog,
}: Props) {
  const isForfait = form.meta?.mode_devis === 'forfait'
  const [localForfait, setLocalForfait] = useState<string>(
    String(form.meta?.tarif_global_hors_lignes_ht ?? ''),
  )
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  const linesTotalHt = useMemo(
    () =>
      form.lines.reduce(
        (sum, line) => sum + lineHt(line.quantity, line.unit_price, line.discount_percent ?? 0),
        0,
      ),
    [form.lines],
  )

  const toggleForfait = (enabled: boolean) => {
    setForm((f) => ({
      ...f,
      meta: {
        ...f.meta,
        mode_devis: enabled ? 'forfait' : undefined,
        tarif_global_hors_lignes_ht: enabled
          ? (f.meta?.tarif_global_hors_lignes_ht ?? 0)
          : undefined,
      },
    }))
  }

  const setLineMasquePdf = (index: number, v: boolean) => {
    setForm((f) => {
      const n = f.lines.length
      const cur = [...(f.meta.ligne_masque_prix_pdf ?? Array(n).fill(false))].slice(0, n)
      while (cur.length < n) cur.push(false)
      cur[index] = v
      return { ...f, meta: { ...f.meta, ligne_masque_prix_pdf: cur } }
    })
  }

  const lineMasque = (index: number) => (form.meta.ligne_masque_prix_pdf?.[index] ?? false) === true

  const addJalon = () => {
    setForm((f) => {
      const newJalon = {
        id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        libelle: '',
        montant_ht: undefined,
        ref_article_id: null,
        commercial_offering_id: null,
      }
      return {
        ...f,
        meta: {
          ...f.meta,
          devis_jalons: [...(f.meta?.devis_jalons ?? []), newJalon],
        },
      }
    })
  }

  const updateJalon = (index: number, field: 'libelle' | 'montant_ht', value: string) => {
    setForm((f) => {
      const list = [...(f.meta?.devis_jalons ?? [])]
      if (!list[index]) return f
      list[index] = {
        ...list[index],
        [field]: field === 'montant_ht' ? (value === '' ? undefined : Number(value)) : value,
      }
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
  }

  const removeJalon = (index: number) => {
    setForm((f) => {
      const list = (f.meta?.devis_jalons ?? []).filter((_, i) => i !== index)
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
  }

  const jalons = form.meta?.devis_jalons ?? []
  const deleteTarget = deleteIndex != null ? form.lines[deleteIndex] : null

  return (
    <div className="qw-body qw-lines-step">
      <p className="qw-section-title">Lignes du devis</p>
      <p className="qw-section-sub">
        Ajoutez des produits depuis le catalogue commercial ou PROLAB, ou saisissez une ligne libre.
      </p>

      <div className="qw-lines-step__mode">
        <span className="qw-lines-step__mode-label">Mode</span>
        <div className="qw-mode-btns">
          <button
            type="button"
            className={`qw-mode-btn${!isForfait ? ' qw-mode-btn--active' : ''}`}
            onClick={() => toggleForfait(false)}
          >
            Détaillé
          </button>
          <button
            type="button"
            className={`qw-mode-btn${isForfait ? ' qw-mode-btn--active' : ''}`}
            onClick={() => toggleForfait(true)}
          >
            Forfait
          </button>
        </div>
      </div>

      {isForfait && (
        <div className="qw-forfait-box">
          <label>
            Montant forfaitaire HT ({MONEY_UNIT_LABEL}) :
            <input
              type="number"
              className="qw-forfait-input"
              min={0}
              step={0.01}
              value={localForfait}
              onChange={(e) => {
                setLocalForfait(e.target.value)
                setForm((f) => ({
                  ...f,
                  meta: {
                    ...f.meta,
                    tarif_global_hors_lignes_ht: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                }))
              }}
              placeholder="0"
            />
          </label>
          <p className="qw-forfait-box__hint">
            En mode forfait, les lignes servent de descriptif (prix masquables sur le PDF).
          </p>
        </div>
      )}

      <div className="quote-lines-toolbar qw-lines-step__toolbar">
        <div>
          <h4 className="qw-lines-step__toolbar-title">Articles & prestations</h4>
          {form.lines.length > 0 && !isForfait ? (
            <p className="qw-lines-step__summary">
              {form.lines.length} ligne{form.lines.length !== 1 ? 's' : ''} · Total HT{' '}
              <strong>{formatMoney(linesTotalHt)}</strong>
            </p>
          ) : null}
        </div>
        <div className="quote-lines-toolbar__btns">
          <button type="button" className="btn btn-primary btn-sm" onClick={onAddFromCommercialCatalog ?? addLine}>
            + Catalogue commercial
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddFromProlabCatalog ?? addLine}>
            + PROLAB
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
            + Ligne libre
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addJalon}>
            + Jalon
          </button>
        </div>
      </div>

      {form.lines.length === 0 ? (
        <div className="qw-lines-step__empty card">
          <p className="qw-lines-step__empty-title">Aucune ligne pour l’instant</p>
          <p className="text-muted" style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
            Choisissez un produit dans le catalogue ou créez une ligne libre pour décrire une prestation.
          </p>
          <div className="quote-lines-toolbar__btns">
            <button type="button" className="btn btn-primary btn-sm" onClick={onAddFromCommercialCatalog ?? addLine}>
              Catalogue commercial
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onAddFromProlabCatalog ?? addLine}>
              PROLAB
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
              Ligne libre
            </button>
          </div>
        </div>
      ) : (
        <div className="quote-lines-table-wrap qw-lines-step__table-wrap">
          <table className="quote-lines-table data-table data-table--compact">
            <thead>
              <tr>
                <th>Origine</th>
                <th>Catalogue</th>
                <th>Désignation</th>
                <th>Qté</th>
                {!isForfait && (
                  <>
                    <th>PU HT</th>
                    <th>Rem. %</th>
                    <th>TVA %</th>
                    <th>Total HT</th>
                  </>
                )}
                {isForfait && <th title="Masquer le prix sur le PDF">PDF</th>}
                <th className="data-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, i) => {
                const ht = lineHt(line.quantity, line.unit_price, line.discount_percent ?? 0)
                return (
                  <tr key={line.row_key ?? i}>
                    <td>
                      <span className={`status-pill ${lineOriginTone(line)}`} style={{ fontSize: '0.72rem' }}>
                        {lineOrigin(line)}
                      </span>
                    </td>
                    <td>
                      <div className="qw-lines-step__catalog-btns">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenCommercialCatalog(i)}
                        >
                          Offre
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenProlabCatalog(i)}
                        >
                          PROLAB
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        className="quote-lines-table__desc"
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(i, 'description', e.target.value)}
                        placeholder="Désignation de la prestation…"
                      />
                    </td>
                    <td>
                      <input
                        className="quote-lines-table__num"
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            updateLine(i, 'quantity', 0)
                            return
                          }
                          updateLine(i, 'quantity', Math.max(0, Math.round(Number(raw))))
                        }}
                      />
                    </td>
                    {!isForfait && (
                      <>
                        <td>
                          <input
                            className="quote-lines-table__num"
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unit_price}
                            onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className="quote-lines-table__num"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={line.discount_percent ?? 0}
                            onChange={(e) => updateLine(i, 'discount_percent', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className="quote-lines-table__num"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={line.tva_rate ?? form.tva_rate ?? 20}
                            onChange={(e) => {
                              const raw = e.target.value
                              if (raw === '') {
                                updateLine(i, 'tva_rate', 0)
                                return
                              }
                              updateLine(
                                i,
                                'tva_rate',
                                Math.min(100, Math.max(0, Math.round(Number(raw)))),
                              )
                            }}
                          />
                        </td>
                        <td className="quote-lines-table__total">{formatMoney(ht)}</td>
                      </>
                    )}
                    {isForfait && (
                      <td>
                        <label className="qw-lines-step__pdf-check" title="Ne pas afficher le prix sur le PDF">
                          <input
                            type="checkbox"
                            checked={lineMasque(i)}
                            onChange={(e) => setLineMasquePdf(i, e.target.checked)}
                          />
                          <span>Masquer</span>
                        </label>
                      </td>
                    )}
                    <td className="data-table__actions">
                      <div className="data-table__actions-inner">
                        <button
                          type="button"
                          className="ds-icon-btn ds-icon-btn--danger"
                          title="Supprimer la ligne"
                          aria-label={`Supprimer la ligne ${i + 1}`}
                          onClick={() => setDeleteIndex(i)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6zM10 11v6M14 11v6"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {jalons.length > 0 && (
        <section className="qw-lines-step__jalons">
          <h4 className="ds-form-section__title">Jalons</h4>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Étapes ou repères dans le parcours du devis (optionnel).
          </p>
          {jalons.map((j, i) => (
            <div key={j.id ?? i} className="qw-jalon-row">
              <input
                value={j.libelle}
                onChange={(e) => updateJalon(i, 'libelle', e.target.value)}
                placeholder="Libellé du jalon…"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={j.montant_ht ?? ''}
                onChange={(e) => updateJalon(i, 'montant_ht', e.target.value)}
                placeholder="Montant HT (opt.)"
                className="qw-jalon-row__amount"
              />
              <button
                type="button"
                className="ds-icon-btn ds-icon-btn--danger"
                title="Supprimer le jalon"
                aria-label="Supprimer le jalon"
                onClick={() => removeJalon(i)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6zM10 11v6M14 11v6"
                  />
                </svg>
              </button>
            </div>
          ))}
        </section>
      )}

      {deleteIndex != null && deleteTarget ? (
        <ConfirmDialog
          title="Supprimer la ligne"
          message={
            <>
              Retirer la ligne{' '}
              <strong>{deleteTarget.description.trim() || `#${deleteIndex + 1}`}</strong> du devis ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          onConfirm={() => {
            removeLine(deleteIndex)
            setDeleteIndex(null)
          }}
          onCancel={() => setDeleteIndex(null)}
        />
      ) : null}
    </div>
  )
}
