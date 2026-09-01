import { Fragment, useMemo, useState } from 'react'
import ConfirmDialog from '../../ConfirmDialog'
import type { QuoteFormState, QuoteLineDraft } from '../QuoteFormFields'
import UniteSelect from '../UniteSelect'
import { lineHt, isJalonForfait, lineLockedByForfaitJalon, quoteFormPricingLines } from '../../../lib/quoteTotals'
import {
  forfaitJalonQuantity,
  forfaitJalonTotalHt,
  forfaitJalonUnitPrice,
  sumForfaitJalonsHt,
  withSyncedForfaitJalonMontant,
} from '../../../lib/quoteForfaitJalon'
import { formatMoney } from '../../../lib/appLocale'
import { getEffectiveDevisParcours, lineKeyForRow } from '../../../lib/devisParcours'
import type { DevisParcoursItem } from '../../../lib/devisParcours'
import { DEFAULT_FORFAIT_UNITE, DEFAULT_QUOTE_UNITE } from '../../../lib/quoteUnites'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  updateLine: (index: number, field: keyof QuoteLineDraft, value: string | number | null | boolean) => void
  removeLine: (index: number) => void
  onOpenS2gCatalog: () => void
  onRemoveJalon: (jalonId: string) => void
}

function lineOrigin(l: QuoteLineDraft): string {
  if (l.parent_jalon_id) return 'S2G'
  if (l.ref_article_id) return 'S2G'
  if (l.commercial_offering_id) return 'Offre'
  if (l.ref_package_id) return 'Forfait'
  return 'Libre'
}

function lineOriginTone(l: QuoteLineDraft): string {
  if (l.parent_jalon_id || l.ref_article_id) return 'status-pill--emerald'
  if (l.commercial_offering_id) return 'status-pill--coral'
  if (l.ref_package_id) return 'status-pill--amber'
  return 'status-pill--slate'
}

type DisplayBlock =
  | { type: 'jalon'; jalonId: string; jalonIndex: number }
  | { type: 'line'; lineIndex: number }

function buildDisplayBlocks(
  form: QuoteFormState,
  jalons: NonNullable<QuoteFormState['meta']['devis_jalons']>,
): DisplayBlock[] {
  const parcours: DevisParcoursItem[] = getEffectiveDevisParcours(form.lines, form.meta)
  const jalonById = new Map(jalons.map((j, i) => [j.id ?? `j-idx-${i}`, { j, i }]))
  const lineIndexByKey = new Map(form.lines.map((l, i) => [lineKeyForRow(l, i), i]))
  const childKeys = new Set(
    jalons.flatMap((j) => j.product_line_keys ?? []),
  )

  const blocks: DisplayBlock[] = []
  const seenJalons = new Set<string>()
  const seenLines = new Set<number>()

  for (const item of parcours) {
    if (item.kind === 'jalon') {
      const entry = jalonById.get(item.id)
      if (!entry || seenJalons.has(item.id)) continue
      seenJalons.add(item.id)
      blocks.push({ type: 'jalon', jalonId: item.id, jalonIndex: entry.i })
    } else {
      const idx = lineIndexByKey.get(item.id)
      if (idx == null || seenLines.has(idx)) continue
      if (childKeys.has(item.id)) continue
      seenLines.add(idx)
      blocks.push({ type: 'line', lineIndex: idx })
    }
  }

  for (const [jalonId, { i }] of jalonById) {
    if (!seenJalons.has(jalonId)) {
      seenJalons.add(jalonId)
      blocks.push({ type: 'jalon', jalonId, jalonIndex: i })
    }
  }

  form.lines.forEach((l, i) => {
    if (seenLines.has(i)) return
    const key = lineKeyForRow(l, i)
    if (childKeys.has(key)) return
    seenLines.add(i)
    blocks.push({ type: 'line', lineIndex: i })
  })

  return blocks
}

function LineRow({
  line,
  lineIndex,
  moneyLocked,
  lockTitle,
  uniteLocked,
  form,
  updateLine,
  onDelete,
  nested,
}: {
  line: QuoteLineDraft
  lineIndex: number
  moneyLocked: boolean
  lockTitle?: string
  uniteLocked?: boolean
  form: QuoteFormState
  updateLine: Props['updateLine']
  onDelete: () => void
  nested?: boolean
}) {
  const qty = moneyLocked ? 1 : line.quantity
  const ht = lineHt(qty, line.unit_price, line.discount_percent ?? 0)
  return (
    <tr className={nested ? 'qw-s2g-line-row qw-s2g-line-row--nested' : 'qw-s2g-line-row'}>
      <td>
        <span className={`status-pill ${lineOriginTone(line)}`} style={{ fontSize: '0.72rem' }}>
          {lineOrigin(line)}
        </span>
      </td>
      <td>
        <input
          className="quote-lines-table__desc"
          type="text"
          value={line.description}
          onChange={(e) => updateLine(lineIndex, 'description', e.target.value)}
          placeholder="Désignation…"
        />
      </td>
      <td>
        <UniteSelect
          value={line.unite || DEFAULT_QUOTE_UNITE}
          disabled={uniteLocked}
          title={
            uniteLocked
              ? 'En forfait, l’unité se choisit sur le jalon'
              : undefined
          }
          onChange={(code) => updateLine(lineIndex, 'unite', code)}
        />
      </td>
      <td>
        <input
          className="quote-lines-table__num"
          type="number"
          min={1}
          step={1}
          value={qty}
          disabled={moneyLocked}
          title={lockTitle}
          onChange={(e) => {
            if (moneyLocked) return
            const raw = e.target.value
            if (raw === '') {
              updateLine(lineIndex, 'quantity', 0)
              return
            }
            updateLine(lineIndex, 'quantity', Math.max(0, Math.round(Number(raw))))
          }}
        />
      </td>
      <td>
        <input
          className="quote-lines-table__num"
          type="number"
          min={0}
          step={0.01}
          value={line.unit_price}
          disabled={moneyLocked}
          title={lockTitle}
          onChange={(e) => {
            if (moneyLocked) return
            updateLine(lineIndex, 'unit_price', Number(e.target.value))
          }}
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
          disabled={moneyLocked}
          title={lockTitle}
          onChange={(e) => {
            if (moneyLocked) return
            updateLine(lineIndex, 'discount_percent', Number(e.target.value))
          }}
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
          disabled={moneyLocked}
          title={lockTitle}
          onChange={(e) => {
            if (moneyLocked) return
            const raw = e.target.value
            if (raw === '') {
              updateLine(lineIndex, 'tva_rate', 0)
              return
            }
            updateLine(lineIndex, 'tva_rate', Math.min(100, Math.max(0, Math.round(Number(raw)))))
          }}
        />
      </td>
      <td className="quote-lines-table__total" title={lockTitle}>
        {moneyLocked ? '—' : formatMoney(ht)}
      </td>
      <td className="data-table__actions">
        <div className="data-table__actions-inner">
          <button
            type="button"
            className="ds-icon-btn ds-icon-btn--danger"
            title="Supprimer la ligne"
            aria-label={`Supprimer la ligne ${lineIndex + 1}`}
            onClick={onDelete}
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
}

export default function WizardStep4Lines({
  form,
  setForm,
  updateLine,
  removeLine,
  onOpenS2gCatalog,
  onRemoveJalon,
}: Props) {
  const isForfait = form.meta?.mode_devis === 'forfait'
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [deleteJalonId, setDeleteJalonId] = useState<string | null>(null)

  const jalons = form.meta?.devis_jalons ?? []

  const forfaitHt = isForfait
    ? sumForfaitJalonsHt(jalons) || Math.max(0, Number(form.meta?.tarif_global_hors_lignes_ht ?? 0))
    : Math.max(0, Number(form.meta?.tarif_global_hors_lignes_ht ?? 0))
  const forfaitTva = Math.min(100, Math.max(0, Number(form.tva_rate ?? 20)))
  const forfaitTvaAmount = Math.round(forfaitHt * (forfaitTva / 100) * 100) / 100
  const forfaitTtc = Math.round((forfaitHt + forfaitTvaAmount) * 100) / 100

  const linesTotalHt = useMemo(
    () =>
      quoteFormPricingLines(
        form.lines,
        jalons,
        form.tva_rate ?? 20,
        isForfait,
        forfaitHt,
      ).reduce((sum, line) => sum + lineHt(line.quantity, line.unit_price, line.discount_percent ?? 0), 0),
    [form.lines, jalons, form.tva_rate, isForfait, forfaitHt],
  )

  const displayBlocks = useMemo(() => buildDisplayBlocks(form, jalons), [form, jalons])

  const hasContent = form.lines.length > 0 || jalons.length > 0

  const lineMoneyLock = (line: QuoteLineDraft, index: number) => {
    if (isForfait) {
      return {
        locked: true,
        title: 'En mode forfait, le montant se saisit sur chaque jalon (qté × PU HT)',
      }
    }
    if (lineLockedByForfaitJalon(line, index, jalons)) {
      return {
        locked: true,
        title: 'En forfait jalon, le montant est saisi sur le jalon',
      }
    }
    return { locked: false, title: undefined as string | undefined }
  }

  const initJalonForfaitPricing = (
    jalon: NonNullable<QuoteFormState['meta']['devis_jalons']>[number],
    jalonId: string,
    lines: QuoteLineDraft[],
    defaultTva: number,
  ) => {
    const childKeys = new Set(jalon.product_line_keys ?? [])
    const childSum = lines.reduce((sum, line, i) => {
      const key = lineKeyForRow(line, i)
      if (line.parent_jalon_id === jalonId || childKeys.has(key)) {
        return sum + lineHt(line.quantity, line.unit_price, line.discount_percent ?? 0)
      }
      return sum
    }, 0)
    const existingPu = forfaitJalonUnitPrice(jalon)
    const pu = existingPu > 0 ? existingPu : childSum
    return withSyncedForfaitJalonMontant({
      ...jalon,
      quantity: forfaitJalonQuantity(jalon),
      prix_unitaire_ht: pu,
      tva_rate: jalon.tva_rate ?? defaultTva,
      unite: (jalon.unite ?? '').trim() || DEFAULT_FORFAIT_UNITE,
    })
  }

  const toggleForfait = (enabled: boolean) => {
    setForm((f) => {
      const nextLines = enabled
        ? f.lines.map((l) => (l.quantity === 1 ? l : { ...l, quantity: 1 }))
        : f.lines
      const meta = { ...f.meta }
      if (enabled) {
        meta.mode_devis = 'forfait'
        const list = [...(meta.devis_jalons ?? [])]
        meta.devis_jalons = list.map((j) =>
          initJalonForfaitPricing(j, j.id ?? '', nextLines, f.tva_rate ?? 20),
        )
        delete meta.ligne_masque_prix_pdf
        delete meta.tarif_global_unite
      } else {
        delete meta.mode_devis
        delete meta.tarif_global_hors_lignes_ht
        delete meta.tarif_global_unite
      }
      return { ...f, lines: nextLines, meta }
    })
  }

  const setForfaitTva = (raw: string) => {
    setForm((f) => ({
      ...f,
      tva_rate: raw === '' ? 0 : Math.min(100, Math.max(0, Math.round(Number(raw)))),
    }))
  }

  const toggleJalonForfait = (jalonId: string, enabled: boolean) => {
    setForm((f) => {
      const list = [...(f.meta.devis_jalons ?? [])]
      const idx = list.findIndex((j) => j.id === jalonId)
      if (idx < 0) return f
      const jalon = { ...list[idx] }
      if (enabled) {
        list[idx] = { ...initJalonForfaitPricing(jalon, jalonId, f.lines, f.tva_rate ?? 20), mode: 'forfait' }
      } else {
        delete jalon.mode
        list[idx] = jalon
      }
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
  }

  const updateJalonLibelle = (jalonId: string, libelle: string) => {
    setForm((f) => {
      const list = [...(f.meta.devis_jalons ?? [])]
      const idx = list.findIndex((j) => j.id === jalonId)
      if (idx < 0) return f
      list[idx] = { ...list[idx], libelle }
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
  }

  const updateJalonForfait = (
    jalonId: string,
    field: 'quantity' | 'prix_unitaire_ht' | 'tva_rate' | 'unite',
    raw: string,
  ) => {
    setForm((f) => {
      const list = [...(f.meta.devis_jalons ?? [])]
      const idx = list.findIndex((j) => j.id === jalonId)
      if (idx < 0) return f
      const base = {
        ...list[idx],
        ...(field !== 'unite' || list[idx].mode === 'forfait' || f.meta?.mode_devis === 'forfait'
          ? { mode: 'forfait' as const }
          : {}),
      }
      let jalon = base
      if (field === 'quantity') {
        jalon = { ...base, quantity: raw === '' ? 1 : Math.max(1, Math.round(Number(raw))) }
      } else if (field === 'prix_unitaire_ht') {
        jalon = { ...base, prix_unitaire_ht: raw === '' ? 0 : Math.max(0, Number(raw)) }
      } else if (field === 'tva_rate') {
        jalon = { ...base, tva_rate: raw === '' ? 0 : Math.min(100, Math.max(0, Math.round(Number(raw)))) }
      } else {
        jalon = { ...base, unite: raw || DEFAULT_FORFAIT_UNITE }
      }
      list[idx] = withSyncedForfaitJalonMontant(jalon)
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
  }

  const lineIndexByKey = useMemo(
    () => new Map(form.lines.map((l, i) => [lineKeyForRow(l, i), i])),
    [form.lines],
  )

  const childLinesForJalon = (productKeys: string[]) => {
    return productKeys
      .map((key) => lineIndexByKey.get(key))
      .filter((i): i is number => i != null)
      .map((i) => ({ line: form.lines[i], index: i }))
  }

  const deleteTarget = deleteIndex != null ? form.lines[deleteIndex] : null
  const deleteJalonTarget = deleteJalonId
    ? jalons.find((j) => j.id === deleteJalonId)
    : null

  return (
    <div className="qw-body qw-lines-step">
      <p className="qw-section-title">Lignes du devis</p>
      <p className="qw-section-sub">
        Ajoutez des jalons depuis le catalogue S2G en suivant le parcours{' '}
        <strong>Qualification → Jalon → Articles</strong>. En mode détaillé, chaque jalon peut être tarifé au forfait
        ou à la ligne.
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

      {isForfait ? (
        <div className="qw-forfait-box">
          <p className="qw-forfait-box__title">Forfait par jalon</p>
          <p className="qw-forfait-box__hint">
            Saisissez la quantité et le PU HT sur chaque jalon. Les prix des articles sont désactivés ; le
            total HT, la TVA et le PDF utilisent ces montants.
          </p>
          <div className="qw-forfait-box__fields">
            <label className="qw-forfait-box__field">
              <span>TVA % (document)</span>
              <input
                className="qw-forfait-input"
                type="number"
                min={0}
                max={100}
                step={1}
                value={forfaitTva}
                onChange={(e) => setForfaitTva(e.target.value)}
              />
            </label>
            <div className="qw-forfait-box__field qw-forfait-box__field--readonly">
              <span>Total HT</span>
              <strong>{formatMoney(forfaitHt)}</strong>
            </div>
            <div className="qw-forfait-box__field qw-forfait-box__field--readonly">
              <span>TVA</span>
              <strong>{formatMoney(forfaitTvaAmount)}</strong>
            </div>
            <div className="qw-forfait-box__field qw-forfait-box__field--readonly">
              <span>Total TTC</span>
              <strong>{formatMoney(forfaitTtc)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <div className="quote-lines-toolbar qw-lines-step__toolbar">
        <div>
          <h4 className="qw-lines-step__toolbar-title">Catalogue S2G</h4>
          {form.lines.length > 0 ? (
            <p className="qw-lines-step__summary">
              {form.lines.length} ligne{form.lines.length !== 1 ? 's' : ''}
              {jalons.length > 0 ? ` · ${jalons.length} jalon${jalons.length !== 1 ? 's' : ''}` : ''}
              {isForfait ? ' · Forfait global' : ''} · Total HT{' '}
              <strong>{formatMoney(linesTotalHt)}</strong>
            </p>
          ) : jalons.length > 0 ? (
            <p className="qw-lines-step__summary">
              {jalons.length} jalon{jalons.length !== 1 ? 's' : ''}
              {isForfait ? ' · Forfait global' : ''}
              {isForfait ? (
                <>
                  {' '}
                  · Total HT <strong>{formatMoney(linesTotalHt)}</strong>
                </>
              ) : null}
            </p>
          ) : isForfait ? (
            <p className="qw-lines-step__summary">
              Forfait global · Total HT <strong>{formatMoney(linesTotalHt)}</strong>
            </p>
          ) : null}
        </div>
        <div className="quote-lines-toolbar__btns">
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenS2gCatalog}>
            + Catalogue S2G
          </button>
        </div>
      </div>

      {!hasContent ? (
        <div className="qw-lines-step__empty card">
          <p className="qw-lines-step__empty-title">Aucun élément pour l’instant</p>
          <p className="text-muted" style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
            Ajoutez un jalon avec les articles souhaités via le parcours Qualification → Jalon → Articles.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenS2gCatalog}>
            Catalogue S2G
          </button>
        </div>
      ) : (
        <div className="quote-lines-table-wrap qw-lines-step__table-wrap">
          <table className="quote-lines-table data-table data-table--compact qw-s2g-lines-table">
            <thead>
              <tr>
                <th>Origine</th>
                <th>Désignation</th>
                <th>Unité</th>
                <th>Qté</th>
                <th>PU HT</th>
                <th>Rem. %</th>
                <th>TVA %</th>
                <th>Total HT</th>
                <th className="data-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayBlocks.map((block) => {
                if (block.type === 'line') {
                  const line = form.lines[block.lineIndex]
                  if (!line) return null
                  const lock = lineMoneyLock(line, block.lineIndex)
                  return (
                    <LineRow
                      key={line.row_key ?? `line-${block.lineIndex}`}
                      line={line}
                      lineIndex={block.lineIndex}
                      moneyLocked={lock.locked}
                      lockTitle={lock.title}
                      uniteLocked={isForfait || lock.locked}
                      form={form}
                      updateLine={updateLine}
                      onDelete={() => setDeleteIndex(block.lineIndex)}
                    />
                  )
                }

                const jalon = jalons[block.jalonIndex]
                if (!jalon) return null
                const productKeys = jalon.product_line_keys ?? []
                const children = childLinesForJalon(productKeys)
                const jalonForfait = isForfait || isJalonForfait(jalon)
                const jalonQty = forfaitJalonQuantity(jalon)
                const jalonPu = forfaitJalonUnitPrice(jalon)
                const jalonHt = forfaitJalonTotalHt(jalon)
                const jalonTva = Math.min(
                  100,
                  Math.max(
                    0,
                    Number(
                      jalonForfait && !isForfait
                        ? (jalon.tva_rate ?? form.tva_rate ?? 20)
                        : (form.tva_rate ?? 20),
                    ),
                  ),
                )
                const jalonTvaAmount = Math.round(jalonHt * (jalonTva / 100) * 100) / 100
                const jalonTtc = Math.round((jalonHt + jalonTvaAmount) * 100) / 100
                const showJalonPricing = jalonForfait

                return (
                  <Fragment key={`jalon-block-${block.jalonId}`}>
                    <tr key={`jalon-${block.jalonId}`} className="qw-s2g-jalon-row">
                      <td>
                        <span className="status-pill status-pill--emerald" style={{ fontSize: '0.72rem' }}>
                          Jalon
                        </span>
                      </td>
                      <td>
                        <div className="qw-s2g-jalon-row__designation">
                          <input
                            className="quote-lines-table__desc qw-s2g-jalon-row__title-input"
                            type="text"
                            value={jalon.libelle}
                            onChange={(e) => updateJalonLibelle(block.jalonId, e.target.value)}
                            placeholder="Nom du jalon…"
                            aria-label="Nom du jalon"
                          />
                          {jalon.s2g_code ? (
                            <span className="text-muted qw-s2g-jalon-row__code">{jalon.s2g_code}</span>
                          ) : null}
                          {!isForfait ? (
                            <div className="qw-mode-btns qw-s2g-jalon-row__mode">
                              <button
                                type="button"
                                className={`qw-mode-btn${!jalonForfait ? ' qw-mode-btn--active' : ''}`}
                                onClick={() => toggleJalonForfait(block.jalonId, false)}
                              >
                                Détaillé
                              </button>
                              <button
                                type="button"
                                className={`qw-mode-btn${jalonForfait ? ' qw-mode-btn--active' : ''}`}
                                onClick={() => toggleJalonForfait(block.jalonId, true)}
                              >
                                Forfait
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {children.length === 0 && jalon.ref_article_id ? (
                          <p className="qw-s2g-jalon-row__empty text-muted">
                            Aucun produit configuré dans Actions &amp; matériel pour ce jalon.
                          </p>
                        ) : null}
                      </td>
                      {showJalonPricing ? (
                        <>
                          <td>
                            <UniteSelect
                              className="qw-forfait-input"
                              value={jalon.unite || DEFAULT_FORFAIT_UNITE}
                              onChange={(code) => updateJalonForfait(block.jalonId, 'unite', code)}
                            />
                          </td>
                          <td>
                            <input
                              className="quote-lines-table__num qw-forfait-input"
                              type="number"
                              min={1}
                              step={1}
                              value={jalonQty}
                              onChange={(e) => updateJalonForfait(block.jalonId, 'quantity', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="quote-lines-table__num qw-forfait-input"
                              type="number"
                              min={0}
                              step={0.01}
                              value={jalonPu}
                              onChange={(e) => updateJalonForfait(block.jalonId, 'prix_unitaire_ht', e.target.value)}
                            />
                          </td>
                          <td className="text-muted">—</td>
                          <td>
                            {!isForfait ? (
                              <input
                                className="quote-lines-table__num qw-forfait-input"
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={jalonTva}
                                onChange={(e) => updateJalonForfait(block.jalonId, 'tva_rate', e.target.value)}
                              />
                            ) : (
                              <span className="text-muted">{jalonTva} %</span>
                            )}
                          </td>
                          <td>
                            <strong>{formatMoney(jalonHt)}</strong>
                            {!isForfait ? (
                              <span className="qw-s2g-jalon-row__forfait-ttc">
                                {' '}
                                · TTC {formatMoney(jalonTtc)}
                              </span>
                            ) : null}
                          </td>
                        </>
                      ) : (
                        <td colSpan={6} />
                      )}
                      <td className="data-table__actions">
                        <button
                          type="button"
                          className="ds-icon-btn ds-icon-btn--danger"
                          title="Retirer le jalon"
                          aria-label="Retirer le jalon"
                          onClick={() => setDeleteJalonId(block.jalonId)}
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
                      </td>
                    </tr>
                    {children.map(({ line, index }) => {
                      const lock = lineMoneyLock(line, index)
                      return (
                        <LineRow
                          key={line.row_key ?? `child-${index}`}
                          line={line}
                          lineIndex={index}
                          moneyLocked={lock.locked}
                          lockTitle={lock.title}
                      uniteLocked={isForfait || lock.locked}
                          form={form}
                          updateLine={updateLine}
                          onDelete={() => setDeleteIndex(index)}
                          nested
                        />
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
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

      {deleteJalonId && deleteJalonTarget ? (
        <ConfirmDialog
          title="Retirer le jalon"
          message={
            <>
              Retirer le jalon <strong>{deleteJalonTarget.libelle}</strong> et ses produits associés ?
            </>
          }
          confirmLabel="Retirer"
          variant="danger"
          onConfirm={() => {
            onRemoveJalon(deleteJalonId)
            setDeleteJalonId(null)
          }}
          onCancel={() => setDeleteJalonId(null)}
        />
      ) : null}
    </div>
  )
}
