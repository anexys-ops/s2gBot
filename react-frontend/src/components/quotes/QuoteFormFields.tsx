import type { ClientAddress, DocumentPdfTemplateRow, Site } from '../../api/client'
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'

export type QuoteLineDraft = {
  commercial_offering_id?: number | null
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
  discount_percent: number
  /** Prix d'achat HT — affichage seulement (rappel catalogue) */
  purchase_ref_ht?: number
}

export type QuoteFormState = {
  client_id: number
  site_id?: number
  quote_date: string
  order_date?: string
  site_delivery_date?: string
  valid_until?: string
  tva_rate?: number
  discount_percent?: number
  discount_amount?: number
  shipping_amount_ht?: number
  shipping_tva_rate?: number
  travel_fee_ht?: number
  travel_fee_tva_rate?: number
  apply_site_travel?: boolean
  billing_address_id?: number
  delivery_address_id?: number
  pdf_template_id?: number
  notes?: string
  lines: QuoteLineDraft[]
}

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  clients: { id: number; name: string }[]
  sites: Site[]
  addresses: ClientAddress[]
  quoteTemplates: DocumentPdfTemplateRow[]
  addLine: () => void
  addEmptyLines: (n: number) => void
  updateLine: (index: number, field: keyof QuoteLineDraft, value: string | number | null) => void
  removeLine: (index: number) => void
  onPickFromCatalog: (lineIndex: number) => void
}

export default function QuoteFormFields({
  form,
  setForm,
  clients,
  sites,
  addresses,
  quoteTemplates,
  addLine,
  addEmptyLines,
  updateLine,
  removeLine,
  onPickFromCatalog,
}: Props) {
  const addrLabel = (a: ClientAddress) =>
    `${a.type}${a.label ? ` — ${a.label}` : ''} : ${a.line1}, ${a.postal_code ?? ''} ${a.city ?? ''}`

  const selectedSite = sites.find((s) => s.id === form.site_id)

  return (
    <>
      <div className="quote-form-grid">
        <label>
          Client *
          <select
            value={form.client_id}
            onChange={(e) => setForm((f) => ({ ...f, client_id: Number(e.target.value) }))}
            required
          >
            <option value={0}>Choisir...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chantier
          <select
            value={form.site_id ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value ? Number(e.target.value) : undefined }))}
          >
            <option value="">—</option>
            {sites.filter((s) => s.client_id === form.client_id).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date devis *
          <input
            type="date"
            value={form.quote_date}
            onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))}
            required
          />
        </label>
        <label>
          Date de commande
          <input
            type="date"
            value={form.order_date ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
          />
        </label>
        <label>
          Livraison chantier
          <input
            type="date"
            value={form.site_delivery_date ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, site_delivery_date: e.target.value }))}
          />
        </label>
        <label>
          Valide jusqu&apos;au
          <input
            type="date"
            value={form.valid_until ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
          />
        </label>
        <label>
          TVA par défaut (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.tva_rate ?? 20}
            onChange={(e) => setForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
          />
        </label>
        <label>
          Remise doc (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.discount_percent ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, discount_percent: Number(e.target.value) }))}
          />
        </label>
        <label>
          Remise doc ({MONEY_UNIT_LABEL} HT)
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.discount_amount ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, discount_amount: Number(e.target.value) }))}
          />
        </label>
        <label>
          Frais port / livraison HT
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.shipping_amount_ht ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, shipping_amount_ht: Number(e.target.value) }))}
          />
        </label>
        <label>
          TVA sur frais de port (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.shipping_tva_rate ?? 20}
            onChange={(e) => setForm((f) => ({ ...f, shipping_tva_rate: Number(e.target.value) }))}
          />
        </label>
        {selectedSite && Number(selectedSite.travel_fee_quote_ht ?? 0) > 0 && (
          <p className="quote-form-travel-hint">
            Forfait déplacement chantier (estimation devis) :{' '}
            {formatMoney(Number(selectedSite.travel_fee_quote_ht))} (HT)
            {selectedSite.travel_fee_label ? ` — ${selectedSite.travel_fee_label}` : ''}
          </p>
        )}
        <label className="quote-form-checkbox-row">
          <input
            type="checkbox"
            checked={form.apply_site_travel ?? false}
            onChange={(e) => setForm((f) => ({ ...f, apply_site_travel: e.target.checked }))}
          />
          Appliquer le forfait déplacement du chantier sur ce devis
        </label>
        <label>
          Frais déplacement HT (manuel)
          <input
            type="number"
            min={0}
            step={0.01}
            disabled={form.apply_site_travel}
            value={form.travel_fee_ht ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, travel_fee_ht: Number(e.target.value) }))}
          />
        </label>
        <label>
          TVA sur déplacement (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            disabled={form.apply_site_travel}
            value={form.travel_fee_tva_rate ?? 20}
            onChange={(e) => setForm((f) => ({ ...f, travel_fee_tva_rate: Number(e.target.value) }))}
          />
        </label>
        <label>
          Adresse facturation
          <select
            value={form.billing_address_id ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                billing_address_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">—</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {addrLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Adresse livraison
          <select
            value={form.delivery_address_id ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                delivery_address_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">—</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {addrLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Modèle PDF
          <select
            value={form.pdf_template_id ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                pdf_template_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">Défaut</option>
            {quoteTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_default ? ' (défaut)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
      </label>

      <div className="quote-lines-toolbar">
        <h4>Lignes du devis</h4>
        <div className="quote-lines-toolbar__btns">
          <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
            + 1 ligne
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => addEmptyLines(5)}>
            + 5 lignes vides
          </button>
        </div>
      </div>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
        Remplissez les lignes ou importez un prix depuis le <strong>catalogue commercial</strong> (bouton Cat.). PA = prix
        d&apos;achat de référence ; PV = prix de vente sur le devis (modifiable).
      </p>

      <div className="quote-lines-table-wrap">
        <table className="quote-lines-table">
          <thead>
            <tr>
              <th>Cat.</th>
              <th>Désignation</th>
              <th>Qté</th>
              <th>PA HT ({MONEY_UNIT_LABEL})</th>
              <th>PV HT ({MONEY_UNIT_LABEL})</th>
              <th>Rem. %</th>
              <th>TVA %</th>
              <th>Total HT ({MONEY_UNIT_LABEL})</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {form.lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPickFromCatalog(index)}>
                    Cat.
                  </button>
                </td>
                <td>
                  <input
                    className="quote-lines-table__desc"
                    placeholder="Désignation"
                    value={line.description}
                    onChange={(e) => updateLine(index, 'description', e.target.value)}
                    required
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    className="quote-lines-table__num"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="quote-lines-table__num"
                    title="Prix achat ref."
                    value={line.purchase_ref_ht ?? ''}
                    onChange={(e) => updateLine(index, 'purchase_ref_ht', e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="quote-lines-table__num"
                    value={line.unit_price}
                    onChange={(e) => updateLine(index, 'unit_price', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="quote-lines-table__num"
                    value={line.discount_percent ?? 0}
                    onChange={(e) => updateLine(index, 'discount_percent', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="quote-lines-table__num"
                    value={line.tva_rate ?? form.tva_rate ?? 20}
                    onChange={(e) => updateLine(index, 'tva_rate', Number(e.target.value))}
                  />
                </td>
                <td className="quote-lines-table__total">
                  {formatMoney(
                    (line.quantity || 0) *
                      (line.unit_price || 0) *
                      (1 - (line.discount_percent ?? 0) / 100),
                  )}
                </td>
                <td>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeLine(index)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
