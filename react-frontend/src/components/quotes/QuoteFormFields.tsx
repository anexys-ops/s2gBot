import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clientContactsApi, type ClientAddress, type ClientContactRow, type DocumentPdfTemplateRow, type DossierRow, type Site, type EntityMetaPayload } from '../../api/client'
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import { lineHt, type DocumentTotalsResult } from '../../lib/quoteTotals'

export type QuoteLineDraft = {
  commercial_offering_id?: number | null
  ref_article_id?: number | null
  ref_package_id?: number | null
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
  discount_percent: number
  /** Produit lié à un forfait / package catalogue (sélection ultérieure côté API) */
  part_of_package?: boolean
}

export type ContextMode = 'client' | 'chantier' | 'dossier'

export type QuoteFormState = {
  contextMode: ContextMode
  client_id: number
  contact_id?: number | null
  site_id?: number
  dossier_id?: number
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
  meta: EntityMetaPayload
}

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  clients: { id: number; name: string }[]
  clientContacts: ClientContactRow[]
  allSites: Site[]
  sitesForClient: Site[]
  dossiers: DossierRow[]
  addresses: ClientAddress[]
  quoteTemplates: DocumentPdfTemplateRow[]
  addLine: () => void
  updateLine: (index: number, field: keyof QuoteLineDraft, value: string | number | null | boolean) => void
  removeLine: (index: number) => void
  onOpenCommercialCatalog: (lineIndex: number) => void
  onOpenProlabCatalog: (lineIndex: number) => void
  totals: DocumentTotalsResult
  clientLabel: string
  siteLabel: string
  dossierLabel: string
}

const TABS = [
  { id: 'lignes', label: 'Lignes' },
  { id: 'frais', label: 'Frais' },
  { id: 'tarif', label: 'Tarif & conditions' },
  { id: 'apercu', label: 'Aperçu' },
] as const

type TabId = (typeof TABS)[number]['id']

const CP_MODE = 'mode_paiement'
const CP_DELAI = 'delai_paiement'
const CP_COND = 'conditions_commerciales'
const CP_NOTES_INT = 'notes_internes'

export default function QuoteFormFields({
  form,
  setForm,
  clients,
  clientContacts,
  allSites,
  sitesForClient,
  dossiers,
  addresses,
  quoteTemplates,
  addLine,
  updateLine,
  removeLine,
  onOpenCommercialCatalog,
  onOpenProlabCatalog,
  totals,
  clientLabel,
  siteLabel,
  dossierLabel,
}: Props) {
  const [tab, setTab] = useState<TabId>('lignes')
  const [contactPanelOpen, setContactPanelOpen] = useState(false)
  const qc = useQueryClient()
  const [contactDraft, setContactDraft] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone_direct: '',
  })
  const [savingContact, setSavingContact] = useState(false)
  const [contactErr, setContactErr] = useState<string | null>(null)

  const selectedSite = useMemo(
    () => allSites.find((s) => s.id === form.site_id) ?? sitesForClient.find((s) => s.id === form.site_id),
    [allSites, sitesForClient, form.site_id],
  )

  const champs = form.meta.champs_perso ?? {}
  const setChamp = (k: string, v: string) => {
    setForm((f) => ({
      ...f,
      meta: {
        ...f.meta,
        champs_perso: { ...(f.meta.champs_perso ?? {}), [k]: v },
      },
    }))
  }

  const addrLabel = (a: ClientAddress) =>
    `${a.type}${a.label ? ` — ${a.label}` : ''} : ${a.line1}, ${a.postal_code ?? ''} ${a.city ?? ''}`

  const applyDossier = (dossierId: number) => {
    const d = dossiers.find((x) => x.id === dossierId)
    if (!d) return
    setForm((f) => ({
      ...f,
      contextMode: 'dossier',
      dossier_id: d.id,
      client_id: d.client_id,
      site_id: d.site_id,
      contact_id: undefined,
    }))
    setTab('lignes')
  }

  const setSiteByChantier = (siteId: number) => {
    const s = allSites.find((x) => x.id === siteId)
    if (!s) return
    setForm((f) => ({
      ...f,
      contextMode: 'chantier',
      site_id: s.id,
      client_id: s.client_id,
      dossier_id: undefined,
      contact_id: undefined,
    }))
  }

  const lineOrigin = (l: QuoteLineDraft) => {
    if (l.commercial_offering_id) return 'COM'
    if (l.ref_article_id) return 'PROLAB'
    if (l.ref_package_id) return 'PACK'
    return '—'
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

  const addFraisSupp = () => {
    setForm((f) => ({
      ...f,
      meta: {
        ...f.meta,
        frais_supplementaires: [
          ...(f.meta.frais_supplementaires ?? []),
          { id: `f${Date.now()}`, description: '', montant_ht: 0, tva_rate: f.tva_rate ?? 20 },
        ],
      },
    }))
  }

  type FraisSuppRow = { id?: string; description: string; montant_ht: number; tva_rate: number }
  const updateFraisItem = (i: number, patch: Partial<FraisSuppRow>) => {
    setForm((f) => {
      const list = [...(f.meta.frais_supplementaires ?? [])]
      if (!list[i]) return f
      list[i] = { ...list[i], ...patch }
      return { ...f, meta: { ...f.meta, frais_supplementaires: list } }
    })
  }

  const removeFraisItem = (i: number) => {
    setForm((f) => ({
      ...f,
      meta: { ...f.meta, frais_supplementaires: (f.meta.frais_supplementaires ?? []).filter((_, j) => j !== i) },
    }))
  }

  const addJalon = () => {
    setForm((f) => ({
      ...f,
      meta: {
        ...f.meta,
        devis_jalons: [
          ...(f.meta?.devis_jalons ?? []),
          { id: `j${Date.now()}`, libelle: '', montant_ht: undefined },
        ],
      },
    }))
  }

  const updateJalon = (i: number, field: 'libelle' | 'montant_ht', v: string | number | undefined) => {
    setForm((f) => {
      const list = [...(f.meta?.devis_jalons ?? [])]
      if (!list[i]) return f
      if (field === 'libelle') list[i] = { ...list[i], libelle: String(v) }
      else list[i] = { ...list[i], montant_ht: v === '' || v === undefined ? undefined : Number(v) }
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
  }

  const removeJalon = (i: number) => {
    setForm((f) => ({
      ...f,
      meta: { ...f.meta, devis_jalons: (f.meta?.devis_jalons ?? []).filter((_, j) => j !== i) },
    }))
  }

  return (
    <>
      <div className="card quote-devis-header">
        <h3 className="ds-form-section__title" style={{ marginTop: 0 }}>
          Contexte, dates & envoi
        </h3>
        <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
          Choisissez comment lier <strong>client</strong> et <strong>chantier</strong> : directement, par chantier, ou
          par un dossier chantier.
        </p>
        <div className="quote-editor-context-modes" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['client', 'chantier', 'dossier'] as const).map((m) => (
            <label key={m} className="quote-editor-context-modes__label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="radio"
                name="ctx"
                checked={form.contextMode === m}
                onChange={() => {
                  setForm((f) => ({ ...f, contextMode: m }))
                  if (m === 'client') {
                    setForm((f) => ({ ...f, site_id: undefined, dossier_id: undefined }))
                  }
                }}
              />
              {m === 'client' ? 'Client' : m === 'chantier' ? 'Chantier d’abord' : 'Dossier chantier'}
            </label>
          ))}
        </div>
        <div className="quote-form-grid">
          {form.contextMode === 'dossier' && (
            <label className="form-group" style={{ gridColumn: '1 / -1' }}>
              Dossier chantier
              <select
                value={form.dossier_id ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : 0
                  if (v) applyDossier(v)
                  else setForm((f) => ({ ...f, dossier_id: undefined }))
                }}
              >
                <option value="">Choisir un dossier…</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.reference} — {d.titre} ({d.client?.name ?? `#${d.client_id}`})
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.contextMode === 'chantier' && (
            <label className="form-group" style={{ gridColumn: '1 / -1' }}>
              Chantier (le client est déduit automatiquement)
              <select
                value={form.site_id ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : 0
                  if (v) setSiteByChantier(v)
                  else setForm((f) => ({ ...f, site_id: undefined, client_id: 0, dossier_id: undefined }))
                }}
              >
                <option value="">Choisir un chantier…</option>
                {allSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.client?.name ?? `Client #${s.client_id}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Client *
            <select
              value={form.client_id}
              onChange={(e) => {
                const id = Number(e.target.value)
                setForm((f) => ({
                  ...f,
                  client_id: id,
                  contact_id: undefined,
                  ...(f.contextMode === 'client' ? { site_id: undefined, dossier_id: undefined } : {}),
                }))
              }}
              disabled={form.contextMode === 'chantier' || form.contextMode === 'dossier'}
              required
            >
              <option value={0}>Choisir…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {form.contextMode === 'client' && (
            <label>
              Chantier
              <select
                value={form.site_id ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value ? Number(e.target.value) : undefined }))}
              >
                <option value="">—</option>
                {sitesForClient.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
            Valable jusqu’au
            <input
              type="date"
              value={form.valid_until ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
            />
          </label>
          <label>
            Date chantier (commande)
            <input
              type="date"
              value={form.order_date ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
            />
          </label>
          <label>
            Livraison chantier estimée
            <input
              type="date"
              value={form.site_delivery_date ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, site_delivery_date: e.target.value }))}
            />
          </label>
          <label>
            Contact
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                style={{ flex: '1 1 200px', minWidth: 0 }}
                value={form.contact_id ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    contact_id: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                disabled={form.client_id <= 0}
              >
                <option value="">—</option>
                {clientContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.prenom, c.nom].filter(Boolean).join(' ').trim() || `Contact #${c.id}`}
                    {c.email ? ` — ${c.email}` : ''}
                  </option>
                ))}
              </select>
              {form.client_id > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setContactErr(null)
                    setContactPanelOpen((o) => !o)
                  }}
                >
                  {contactPanelOpen ? 'Fermer' : 'Nouveau contact'}
                </button>
              )}
            </div>
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
      </div>

      {contactPanelOpen && form.client_id > 0 && (
        <div className="quote-contact-overlay" onClick={() => setContactPanelOpen(false)} role="presentation">
          <div className="quote-contact-slide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nouveau contact">
            <h3 className="ds-form-section__title" style={{ marginTop: 0 }}>
              Nouveau contact
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Rattachement immédiat au client courant.</p>
            <div className="quote-form-grid" style={{ marginTop: '0.5rem' }}>
              <label>
                Prénom
                <input
                  value={contactDraft.prenom}
                  onChange={(e) => setContactDraft((d) => ({ ...d, prenom: e.target.value }))}
                />
              </label>
              <label>
                Nom
                <input value={contactDraft.nom} onChange={(e) => setContactDraft((d) => ({ ...d, nom: e.target.value }))} />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={contactDraft.email}
                  onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </label>
              <label>
                Téléphone
                <input
                  value={contactDraft.telephone_direct}
                  onChange={(e) => setContactDraft((d) => ({ ...d, telephone_direct: e.target.value }))}
                />
              </label>
            </div>
            {contactErr && <p className="error">{contactErr}</p>}
            <div className="quote-contact-slide__actions" style={{ marginTop: '1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingContact || !contactDraft.prenom.trim() || !contactDraft.nom.trim()}
                onClick={async () => {
                  setContactErr(null)
                  setSavingContact(true)
                  try {
                    const row = await clientContactsApi.create(form.client_id, {
                      prenom: contactDraft.prenom.trim(),
                      nom: contactDraft.nom.trim(),
                      email: contactDraft.email.trim() || undefined,
                      telephone_direct: contactDraft.telephone_direct.trim() || undefined,
                    })
                    setForm((f) => ({ ...f, contact_id: row.id }))
                    await qc.invalidateQueries({ queryKey: ['client-contacts', form.client_id] })
                    setContactDraft({ prenom: '', nom: '', email: '', telephone_direct: '' })
                    setContactPanelOpen(false)
                  } catch (e) {
                    setContactErr((e as Error).message)
                  } finally {
                    setSavingContact(false)
                  }
                }}
              >
                {savingContact ? 'Enregistrement…' : 'Créer et sélectionner'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setContactPanelOpen(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="quote-editor-tabs" role="tablist" aria-label="Sections du devis">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`quote-editor-tabs__btn${tab === t.id ? ' quote-editor-tabs__btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lignes' && (
        <section className="ds-form-section quote-editor-panel">
          <h3 className="ds-form-section__title">Lignes d’article et prestations</h3>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Aucune ligne préremplie : ajoutez-les une par une. <strong>Offre</strong> (catalogue commercial) ou{' '}
            <strong>PROLAB</strong> (famille → produit). Le PA n’est pas affiché à l’écran.
          </p>
          {form.lines.length === 0 && (
            <div className="card" style={{ marginBottom: '1rem', maxWidth: 400 }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Aucun article. Forfait global (sans lignes) optionnel :</p>
              <label className="form-group" style={{ marginTop: '0.5rem' }}>
                Tarif global HT (hors lignes)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.meta?.tarif_global_hors_lignes_ht ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      meta: {
                        ...f.meta,
                        tarif_global_hors_lignes_ht: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
            </div>
          )}
          <div className="quote-lines-toolbar">
            <div className="quote-lines-toolbar__btns">
              <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
                + Ajouter une ligne
              </button>
            </div>
          </div>
          {form.lines.length > 0 && (
            <div className="quote-lines-table-wrap">
              <table className="quote-lines-table data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Origine</th>
                    <th>Offre / PROLAB</th>
                    <th>Désignation</th>
                    <th>Qté</th>
                    <th>PV HT</th>
                    <th>Rem. %</th>
                    <th>TVA %</th>
                    <th>Total HT</th>
                    <th>Groupe</th>
                    <th title="Ne pas afficher le prix de cette ligne sur le PDF">PDF</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, index) => (
                    <tr key={index}>
                      <td>
                        <span className="status-pill status-pill--slate" style={{ fontSize: '0.7rem' }}>
                          {lineOrigin(line)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenCommercialCatalog(index)}>
                            Offre
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenProlabCatalog(index)}>
                            PROLAB
                          </button>
                        </div>
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
                        {formatMoney(lineHt(line.quantity || 0, line.unit_price || 0, line.discount_percent ?? 0))}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          title="Ligne liée à un forfait / regroupement"
                          checked={line.part_of_package ?? false}
                          onChange={(e) => updateLine(index, 'part_of_package', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          title="Ne pas afficher le prix de cette ligne sur le PDF"
                          checked={lineMasque(index)}
                          onChange={(e) => setLineMasquePdf(index, e.target.checked)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => removeLine(index)}
                          aria-label="Supprimer la ligne"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 className="ds-form-section__title" style={{ marginTop: '1.5rem' }}>
            Jalons (rappel facturation / suivi)
          </h4>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>Métadonnées du devis, utiles pour le suivi (PDF / interne selon intégration future).</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addJalon}>
            + Jalon
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {(form.meta?.devis_jalons ?? []).map((j, i) => (
              <div key={j.id ?? i} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 40px', gap: 8, padding: '0.6rem' }}>
                <input
                  placeholder="Libellé (ex. Acompte 30 %)"
                  value={j.libelle}
                  onChange={(e) => updateJalon(i, 'libelle', e.target.value)}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="HT"
                  value={j.montant_ht ?? ''}
                  onChange={(e) => updateJalon(i, 'montant_ht', e.target.value === '' ? undefined : Number(e.target.value))}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeJalon(i)} aria-label="Supprimer">
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'frais' && (
        <section className="ds-form-section quote-editor-panel">
          <h3 className="ds-form-section__title">Frais de port et déplacement</h3>
          <div className="quote-form-grid">
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
              <p className="quote-form-travel-hint" style={{ gridColumn: '1 / -1' }}>
                Forfait déplacement chantier (estimation) : {formatMoney(Number(selectedSite.travel_fee_quote_ht))} (HT)
                {selectedSite.travel_fee_label ? ` — ${selectedSite.travel_fee_label}` : ''}
              </p>
            )}
            <label className="quote-form-checkbox-row" style={{ gridColumn: '1 / -1' }}>
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
          </div>

          <h4 className="ds-form-section__title" style={{ marginTop: '1.25rem' }}>Frais complémentaires (brouillon)</h4>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Stockés en métadonnées ; comptent pour l’évolution PDF. Le recalcul serveur reste sur port + déplacement uniquement.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addFraisSupp}>
            + Ligne
          </button>
          <div className="quote-frais-extra-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="data-table data-table--compact" style={{ width: '100%', maxWidth: 640 }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Montant HT</th>
                  <th>TVA %</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(form.meta.frais_supplementaires ?? []).map((row, i) => (
                  <tr key={row.id ?? i}>
                    <td>
                      <input
                        value={row.description}
                        onChange={(e) => updateFraisItem(i, { description: e.target.value })}
                        style={{ width: '100%' }}
                        placeholder="Intitulé"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.montant_ht}
                        onChange={(e) => updateFraisItem(i, { montant_ht: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={row.tva_rate}
                        onChange={(e) => updateFraisItem(i, { tva_rate: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeFraisItem(i)} aria-label="Supprimer">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(form.meta.frais_supplementaires?.length ?? 0) === 0 && <p className="text-muted" style={{ fontSize: '0.9rem' }}>Aucun frais supplémentaire.</p>}
          </div>
        </section>
      )}

      {tab === 'tarif' && (
        <section className="ds-form-section quote-editor-panel">
          <h3 className="ds-form-section__title">TVA, remises, adresses, conditions & notes</h3>
          <div className="quote-form-grid">
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
              Remise sur document (%)
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
              Remise sur document ({MONEY_UNIT_LABEL} HT)
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.discount_amount ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, discount_amount: Number(e.target.value) }))}
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
              Mode de paiement
              <input value={champs[CP_MODE] ?? ''} onChange={(e) => setChamp(CP_MODE, e.target.value)} placeholder="Ex. virement" />
            </label>
            <label>
              Délai
              <input
                value={champs[CP_DELAI] ?? ''}
                onChange={(e) => setChamp(CP_DELAI, e.target.value)}
                placeholder="Ex. 30 jours fin de mois"
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Conditions particulières
              <textarea
                value={champs[CP_COND] ?? ''}
                onChange={(e) => setChamp(CP_COND, e.target.value)}
                rows={3}
                placeholder="Conditions d’exécution, clauses…"
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Notes internes (métadonnée, non imprimée côté PDF)
              <textarea
                value={champs[CP_NOTES_INT] ?? ''}
                onChange={(e) => setChamp(CP_NOTES_INT, e.target.value)}
                rows={3}
              />
            </label>
            <label className="form-group" style={{ gridColumn: '1 / -1' }}>
              Notes (champ devis, usage selon intégration)
              <textarea
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </label>
          </div>
        </section>
      )}

      {tab === 'apercu' && (
        <section className="ds-form-section quote-editor-panel">
          <h3 className="ds-form-section__title">Aperçu (résumé)</h3>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>Aperçu brouillon des montants. Le PDF généré suit les règles côté serveur.</p>
          <ul className="quote-apercu-list" style={{ listStyle: 'none', padding: 0, margin: 0, maxWidth: 520 }}>
            <li>
              <strong>Client :</strong> {clientLabel}
            </li>
            <li>
              <strong>Chantier :</strong> {siteLabel}
            </li>
            {form.dossier_id && (
              <li>
                <strong>Dossier :</strong> {dossierLabel}
              </li>
            )}
            <li>
              <strong>Lignes (saisies) :</strong> {form.lines.filter((l) => l.description.trim().length > 0).length}
            </li>
            <li style={{ marginTop: '0.75rem' }}>
              <strong>Total HT (aperçu) :</strong> {formatMoney(totals.amount_ht)}
            </li>
            <li>
              <strong>Total TVA (aperçu) :</strong> {formatMoney(totals.amount_tva)}
            </li>
            <li>
              <strong>Total TTC (aperçu) :</strong> {formatMoney(totals.amount_ttc)}
            </li>
          </ul>
        </section>
      )}
    </>
  )
}
