import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import { lineHt } from '../../lib/quoteTotals'

export type InvoiceLineDraft = {
  row_key: string
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
  discount_percent: number
}

type Props = {
  lines: InvoiceLineDraft[]
  defaultTva: number
  editable: boolean
  onChange: (lines: InvoiceLineDraft[]) => void
}

function newLine(defaultTva: number): InvoiceLineDraft {
  return {
    row_key: `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    quantity: 1,
    unit_price: 0,
    tva_rate: defaultTva,
    discount_percent: 0,
  }
}

export default function InvoiceLinesEditor({ lines, defaultTva, editable, onChange }: Props) {
  const updateLine = (index: number, patch: Partial<InvoiceLineDraft>) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index))
  }

  const addLine = () => {
    onChange([...lines, newLine(defaultTva)])
  }

  const totalHt = lines.reduce(
    (acc, l) => acc + lineHt(l.quantity, l.unit_price, l.discount_percent),
    0,
  )

  return (
    <section className="invoice-lines-editor">
      <div className="invoice-lines-editor__header">
        <h3 className="h3">Lignes de facture</h3>
        {editable ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
            Ajouter une ligne
          </button>
        ) : null}
      </div>
      {lines.length === 0 ? (
        <p className="text-muted">Aucune ligne.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table data-table--compact invoice-lines-editor__table">
            <thead>
              <tr>
                <th>Désignation</th>
                <th className="data-table__num">Qté</th>
                <th className="data-table__num">PU HT</th>
                <th className="data-table__num">TVA %</th>
                <th className="data-table__num">Rem. %</th>
                <th className="data-table__num">Total HT</th>
                {editable ? <th className="data-table__actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.row_key}>
                  <td>
                    {editable ? (
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                        placeholder="Description"
                        style={{ width: '100%' }}
                      />
                    ) : (
                      line.description
                    )}
                  </td>
                  <td className="data-table__num">
                    {editable ? (
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 1 })}
                        style={{ width: 72 }}
                      />
                    ) : (
                      line.quantity
                    )}
                  </td>
                  <td className="data-table__num">
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unit_price}
                        onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) || 0 })}
                        style={{ width: 96 }}
                      />
                    ) : (
                      formatMoney(line.unit_price)
                    )}
                  </td>
                  <td className="data-table__num">
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={line.tva_rate}
                        onChange={(e) => updateLine(index, { tva_rate: Number(e.target.value) || 0 })}
                        style={{ width: 72 }}
                      />
                    ) : (
                      `${line.tva_rate} %`
                    )}
                  </td>
                  <td className="data-table__num">
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={line.discount_percent}
                        onChange={(e) => updateLine(index, { discount_percent: Number(e.target.value) || 0 })}
                        style={{ width: 72 }}
                      />
                    ) : (
                      `${line.discount_percent} %`
                    )}
                  </td>
                  <td className="data-table__num">
                    {formatMoney(lineHt(line.quantity, line.unit_price, line.discount_percent))}
                  </td>
                  {editable ? (
                    <td className="data-table__actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => removeLine(index)}
                        aria-label="Supprimer la ligne"
                      >
                        ×
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="invoice-lines-editor__total text-muted">
        Total lignes HT : <strong>{formatMoney(totalHt)} {MONEY_UNIT_LABEL}</strong>
      </p>
    </section>
  )
}

export function invoiceLinesFromApi(
  lines: Array<{
    description: string
    quantity: number
    unit_price: number
    tva_rate?: number
    discount_percent?: number
  }> | undefined,
  defaultTva: number,
): InvoiceLineDraft[] {
  return (lines ?? []).map((l, i) => ({
    row_key: `loaded-${i}`,
    description: l.description,
    quantity: l.quantity,
    unit_price: Number(l.unit_price),
    tva_rate: l.tva_rate != null ? Number(l.tva_rate) : defaultTva,
    discount_percent: l.discount_percent != null ? Number(l.discount_percent) : 0,
  }))
}

export function invoiceLinesToApi(lines: InvoiceLineDraft[]) {
  return lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      description: l.description.trim(),
      quantity: Math.max(1, Math.round(l.quantity)),
      unit_price: l.unit_price,
      tva_rate: l.tva_rate,
      discount_percent: l.discount_percent,
    }))
}
