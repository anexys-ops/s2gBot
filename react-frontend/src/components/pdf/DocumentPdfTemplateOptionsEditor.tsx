import type { Dispatch, SetStateAction } from 'react'
import type { PdfLayoutConfigForm } from '../../lib/pdfLayoutConfig'

type Props = {
  form: PdfLayoutConfigForm
  setForm: Dispatch<SetStateAction<PdfLayoutConfigForm>>
  disabled?: boolean
  documentType: string
}

function setLine<K extends keyof PdfLayoutConfigForm['lines']>(
  setForm: Dispatch<SetStateAction<PdfLayoutConfigForm>>,
  key: K,
  value: PdfLayoutConfigForm['lines'][K],
) {
  setForm((f) => ({ ...f, lines: { ...f.lines, [key]: value } }))
}

function setMeta<K extends keyof PdfLayoutConfigForm['meta']>(
  setForm: Dispatch<SetStateAction<PdfLayoutConfigForm>>,
  key: K,
  value: PdfLayoutConfigForm['meta'][K],
) {
  setForm((f) => ({ ...f, meta: { ...f.meta, [key]: value } }))
}

export default function DocumentPdfTemplateOptionsEditor({ form, setForm, disabled, documentType }: Props) {
  const isReport = documentType === 'report'
  const showCommercialOptions = !isReport

  return (
    <>
      {showCommercialOptions ? (
        <section className="pdf-layout-editor__section">
          <h3 className="pdf-layout-editor__h">En-tête document</h3>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.meta.show_client_name}
              onChange={(e) => setMeta(setForm, 'show_client_name', e.target.checked)}
              disabled={disabled}
            />
            Afficher le nom du client
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.meta.show_dossier_reference}
              onChange={(e) => setMeta(setForm, 'show_dossier_reference', e.target.checked)}
              disabled={disabled}
            />
            Afficher la référence dossier
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.meta.show_linked_quote}
              onChange={(e) => setMeta(setForm, 'show_linked_quote', e.target.checked)}
              disabled={disabled}
            />
            Afficher le devis lié (BC / BL)
          </label>
          {documentType === 'quote' && (
            <label className="pdf-layout-editor__check">
              <input
                type="checkbox"
                checked={form.meta.show_affaire}
                onChange={(e) => setMeta(setForm, 'show_affaire', e.target.checked)}
                disabled={disabled}
              />
              Afficher le libellé affaire / chantier
            </label>
          )}
        </section>
      ) : null}

      {showCommercialOptions ? (
        <section className="pdf-layout-editor__section">
          <h3 className="pdf-layout-editor__h">Lignes du document</h3>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.lines.show_designation}
              onChange={(e) => setLine(setForm, 'show_designation', e.target.checked)}
              disabled={disabled}
            />
            Afficher les désignations
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.lines.show_article_code}
              onChange={(e) => setLine(setForm, 'show_article_code', e.target.checked)}
              disabled={disabled}
            />
            Afficher les codes / références article
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.lines.show_quantity}
              onChange={(e) => setLine(setForm, 'show_quantity', e.target.checked)}
              disabled={disabled}
            />
            Afficher les quantités
          </label>
          <label className="pdf-layout-editor__check">
            <input
              type="checkbox"
              checked={form.lines.show_unit}
              onChange={(e) => setLine(setForm, 'show_unit', e.target.checked)}
              disabled={disabled}
            />
            Afficher les unités
          </label>
          {documentType === 'quote' && (
            <label className="pdf-layout-editor__check">
              <input
                type="checkbox"
                checked={form.lines.show_line_details}
                onChange={(e) => setLine(setForm, 'show_line_details', e.target.checked)}
                disabled={disabled}
              />
              Afficher les détails sous les lignes
            </label>
          )}
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
          {(documentType === 'quote' || documentType === 'invoice') && (
            <label className="pdf-layout-editor__check">
              <input
                type="checkbox"
                checked={form.lines.show_tva_column}
                onChange={(e) => setLine(setForm, 'show_tva_column', e.target.checked)}
                disabled={disabled || !form.lines.show_prices || !form.totals.show_total_tva}
              />
              Afficher la colonne TVA par ligne (modèles détaillés)
            </label>
          )}
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
