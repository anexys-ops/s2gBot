import type { Dispatch, SetStateAction } from 'react'
import type { PdfLayoutConfigForm } from '../../lib/pdfLayoutConfig'

type Props = {
  form: PdfLayoutConfigForm
  setForm: Dispatch<SetStateAction<PdfLayoutConfigForm>>
  disabled?: boolean
  documentType: string
}

export default function DocumentPdfTemplateOptionsEditor({ form, setForm, disabled, documentType }: Props) {
  const isReport = documentType === 'report'
  const showCommercialOptions = !isReport

  return (
    <>
      {showCommercialOptions ? (
        <section className="pdf-layout-editor__section">
          <h3 className="pdf-layout-editor__h">Lignes du document</h3>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.lines.show_prices}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  lines: {
                    ...f.lines,
                    show_prices: e.target.checked,
                    show_pu_pt_columns: e.target.checked ? f.lines.show_pu_pt_columns : false,
                  },
                }))
              }
              disabled={disabled}
            />
            Afficher les prix sur les lignes
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.lines.show_pu_pt_columns}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  lines: { ...f.lines, show_pu_pt_columns: e.target.checked, show_prices: e.target.checked ? true : f.lines.show_prices },
                }))
              }
              disabled={disabled || !form.lines.show_prices}
            />
            Afficher les colonnes PU HT / PT HT
          </label>
        </section>
      ) : null}

      {showCommercialOptions ? (
        <section className="pdf-layout-editor__section">
          <h3 className="pdf-layout-editor__h">Cadre totaux</h3>
          <p className="pdf-layout-editor__hint">
            Montants affichés dans le récapitulatif. Si aucune case n&apos;est cochée, le cadre est masqué.
          </p>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.totals.show_total_ht}
              onChange={(e) => setForm((f) => ({ ...f, totals: { ...f.totals, show_total_ht: e.target.checked } }))}
              disabled={disabled}
            />
            Afficher Total HT
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.totals.show_total_tva}
              onChange={(e) => setForm((f) => ({ ...f, totals: { ...f.totals, show_total_tva: e.target.checked } }))}
              disabled={disabled}
            />
            Afficher Total TVA
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.totals.show_total_ttc}
              onChange={(e) => setForm((f) => ({ ...f, totals: { ...f.totals, show_total_ttc: e.target.checked } }))}
              disabled={disabled}
            />
            Afficher Total TTC
          </label>
        </section>
      ) : null}

      {isReport ? (
        <section className="pdf-layout-editor__section">
          <h3 className="pdf-layout-editor__h">Rapport d&apos;essais</h3>
          <p className="pdf-layout-editor__hint">
            Options avancées (logo, champs, signature) : utilisez l&apos;éditeur complet ci-dessous si besoin.
          </p>
        </section>
      ) : null}
    </>
  )
}
