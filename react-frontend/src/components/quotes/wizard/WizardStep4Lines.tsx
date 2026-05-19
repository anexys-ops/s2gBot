import { useState } from 'react'
import type { QuoteFormState, QuoteLineDraft } from '../QuoteFormFields'
import { lineHt } from '../../../lib/quoteTotals'
import { formatMoney } from '../../../lib/appLocale'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  addLine: () => void
  updateLine: (index: number, field: keyof QuoteLineDraft, value: string | number | null | boolean) => void
  removeLine: (index: number) => void
  onOpenCommercialCatalog: (lineIndex: number) => void
  onOpenProlabCatalog: (lineIndex: number) => void
}

export default function WizardStep4Lines({
  form,
  setForm,
  addLine,
  updateLine,
  removeLine,
  onOpenCommercialCatalog,
  onOpenProlabCatalog,
}: Props) {
  const isForfait = form.meta?.mode_devis === 'forfait'
  const [localForfait, setLocalForfait] = useState<string>(
    String(form.meta?.tarif_global_hors_lignes_ht ?? ''),
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

  return (
    <div className="qw-body">
      <p className="qw-section-title">Lignes du devis</p>
      <p className="qw-section-sub">Ajoutez les articles et jalons.</p>

      {/* Mode toggle */}
      <div className="qw-mode-btns" style={{ marginBottom: '1rem' }}>
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

      {isForfait && (
        <div className="qw-forfait-box">
          <label>
            Montant forfaitaire HT :
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
              placeholder="0.00"
            />
          </label>
          <p style={{ fontSize: '.8rem', color: '#92400e', marginTop: '.5rem' }}>
            En mode forfait, les lignes servent de descriptif (prix masqués sur le PDF).
          </p>
        </div>
      )}

      {/* Lines table */}
      {form.lines.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="qw-lines-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>Désignation</th>
                <th style={{ width: '7%' }}>Qté</th>
                {!isForfait && (
                  <>
                    <th style={{ width: '10%' }}>PU HT</th>
                    <th style={{ width: '8%' }}>TVA %</th>
                    <th style={{ width: '8%' }}>Remise %</th>
                    <th style={{ width: '10%' }}>S-total HT</th>
                  </>
                )}
                <th style={{ width: '7%' }}>Cat.</th>
                <th style={{ width: '4%' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, i) => {
                const ht = lineHt(line.quantity, line.unit_price, line.discount_percent ?? 0)
                return (
                  <tr key={line.row_key ?? i}>
                    <td>
                      <input
                        className="qw-lines-input"
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(i, 'description', e.target.value)}
                        placeholder="Description…"
                      />
                    </td>
                    <td>
                      <input
                        className="qw-lines-input"
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.quantity}
                        onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                        style={{ width: '70px' }}
                      />
                    </td>
                    {!isForfait && (
                      <>
                        <td>
                          <input
                            className="qw-lines-input"
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unit_price}
                            onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value))}
                            style={{ width: '90px' }}
                          />
                        </td>
                        <td>
                          <input
                            className="qw-lines-input"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={line.tva_rate}
                            onChange={(e) => updateLine(i, 'tva_rate', Number(e.target.value))}
                            style={{ width: '65px' }}
                          />
                        </td>
                        <td>
                          <input
                            className="qw-lines-input"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={line.discount_percent ?? 0}
                            onChange={(e) =>
                              updateLine(i, 'discount_percent', Number(e.target.value))
                            }
                            style={{ width: '65px' }}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatMoney(ht)}
                        </td>
                      </>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          title="Catalogue commercial"
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '.9rem',
                          }}
                          onClick={() => onOpenCommercialCatalog(i)}
                        >
                          🔍
                        </button>
                        <button
                          type="button"
                          title="Catalogue PROLAB"
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '.9rem',
                          }}
                          onClick={() => onOpenProlabCatalog(i)}
                        >
                          🧪
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                        onClick={() => removeLine(i)}
                        title="Supprimer"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Jalons */}
      {jalons.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Jalons</p>
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
                style={{
                  width: '130px',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '.25rem .5rem',
                  background: 'transparent',
                  fontSize: '.88rem',
                  color: '#166534',
                }}
              />
              <button
                type="button"
                onClick={() => removeJalon(i)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
        <button type="button" className="qw-add-line-btn" onClick={addLine}>
          + Ligne article
        </button>
        <button type="button" className="qw-add-line-btn" onClick={addJalon}>
          + Jalon
        </button>
      </div>
    </div>
  )
}
