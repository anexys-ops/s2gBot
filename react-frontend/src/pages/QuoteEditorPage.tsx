import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageBackNav from '../components/PageBackNav'
import Modal from '../components/Modal'
import QuoteFormFields, { type QuoteFormState, type QuoteLineDraft, type ContextMode } from '../components/quotes/QuoteFormFields'
import QuoteFooterSticky from '../components/quotes/QuoteFooterSticky'
import {
  quotesApi,
  clientsApi,
  sitesApi,
  clientAddressesApi,
  clientContactsApi,
  documentPdfTemplatesApi,
  commercialOfferingsApi,
  catalogueApi,
  dossiersApi,
  type QuoteCreateBody,
  type EntityMetaPayload,
  type CommercialOffering,
  type RefArticleRow,
  type RefFamilleArticleRow,
} from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatMoney } from '../lib/appLocale'
import { computeQuoteFormDocumentTotals, sumFraisSupplementairesTtc } from '../lib/quoteTotals'
import {
  getEffectiveDevisParcours,
  buildDefaultDevisParcours,
  lineKeyForRow,
  filterDevisParcoursRemoveLigne,
  normalizeDevisParcoursInMeta,
} from '../lib/devisParcours'

function newLineRowKey() {
  return `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function emptyLine(defaultTva: number): QuoteLineDraft {
  return {
    row_key: newLineRowKey(),
    description: '',
    quantity: 1,
    unit_price: 0,
    tva_rate: defaultTva,
    discount_percent: 0,
    part_of_package: false,
  }
}

function emptyForm(): QuoteFormState {
  const tva = 20
  return {
    contextMode: 'client',
    client_id: 0,
    contact_id: undefined,
    site_id: undefined,
    dossier_id: undefined,
    quote_date: new Date().toISOString().slice(0, 10),
    order_date: '',
    site_delivery_date: '',
    valid_until: '',
    tva_rate: tva,
    discount_percent: 0,
    discount_amount: 0,
    shipping_amount_ht: 0,
    shipping_tva_rate: 20,
    travel_fee_ht: 0,
    travel_fee_tva_rate: 20,
    apply_site_travel: false,
    notes: '',
    lines: [],
    meta: {},
  }
}

function inferContextMode(quote: { dossier_id?: number | null; site_id?: number | null }): ContextMode {
  if (quote.dossier_id) return 'dossier'
  return 'client'
}

function toApiBody(form: QuoteFormState): QuoteCreateBody {
  const defaultTva = form.tva_rate ?? 20
  const lines = form.lines
    .filter((l) => l.description.trim().length > 0 && l.quantity > 0)
    .map((l) => {
      const row: QuoteCreateBody['lines'][number] = {
        description: l.description.trim(),
        quantity: l.quantity,
        unit_price: l.unit_price,
        tva_rate: l.tva_rate ?? defaultTva,
        discount_percent: l.discount_percent ?? 0,
      }
      if (l.commercial_offering_id) row.commercial_offering_id = l.commercial_offering_id
      if (l.ref_article_id) row.ref_article_id = l.ref_article_id
      if (l.ref_package_id) row.ref_package_id = l.ref_package_id
      if (l.commercial_offering_id || l.ref_article_id || l.ref_package_id) {
        row.type_ligne = 'catalogue'
      }
      return row
    })

  const meta: EntityMetaPayload = { ...form.meta }
  if (meta.devis_jalons && meta.devis_jalons.length === 0) delete meta.devis_jalons
  if (meta.tarif_global_hors_lignes_ht == null) delete meta.tarif_global_hors_lignes_ht
  if (meta.frais_supplementaires && meta.frais_supplementaires.length === 0) delete meta.frais_supplementaires
  if (meta.ligne_masque_prix_pdf && !meta.ligne_masque_prix_pdf.some(Boolean)) delete meta.ligne_masque_prix_pdf
  normalizeDevisParcoursInMeta(form.lines, meta.devis_jalons, meta)
  if (meta.devis_parcours && meta.devis_parcours.length === 0) delete meta.devis_parcours
  const hasMeta = Object.keys(meta).length > 0

  return {
    client_id: form.client_id,
    contact_id: form.contact_id,
    site_id: form.site_id,
    dossier_id: form.dossier_id,
    quote_date: form.quote_date,
    order_date: form.order_date || undefined,
    site_delivery_date: form.site_delivery_date || undefined,
    valid_until: form.valid_until || undefined,
    tva_rate: form.tva_rate,
    discount_percent: form.discount_percent,
    discount_amount: form.discount_amount,
    shipping_amount_ht: form.shipping_amount_ht,
    shipping_tva_rate: form.shipping_tva_rate,
    travel_fee_ht: form.travel_fee_ht,
    travel_fee_tva_rate: form.travel_fee_tva_rate,
    apply_site_travel: form.apply_site_travel,
    billing_address_id: form.billing_address_id,
    delivery_address_id: form.delivery_address_id,
    pdf_template_id: form.pdf_template_id,
    notes: form.notes,
    lines,
    meta: hasMeta ? meta : undefined,
  }
}

export default function QuoteEditorPage() {
  const { quoteId } = useParams<{ quoteId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const editingNumericId = quoteId && quoteId !== 'nouveau' ? Number(quoteId) : null
  const isCreate = editingNumericId === null || Number.isNaN(editingNumericId)

  const [form, setForm] = useState<QuoteFormState>(emptyForm)
  type LineOrJalon = { target: 'line'; index: number } | { target: 'jalon'; jalonIndex: number }
  const [catalogPick, setCatalogPick] = useState<LineOrJalon | null>(null)
  const [prolabPick, setProlabPick] = useState<LineOrJalon | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [prolabFamilleId, setProlabFamilleId] = useState<number | ''>('')
  const catalogDebounced = useDebouncedValue(catalogSearch, 250)

  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', editingNumericId],
    queryFn: () => quotesApi.get(editingNumericId!),
    enabled: !isCreate && editingNumericId !== null,
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
  })

  const { data: allSitesData } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => sitesApi.list(),
    enabled: isLab,
  })

  const { data: dossiersData } = useQuery({
    queryKey: ['dossiers', 'all-devis'],
    queryFn: () => dossiersApi.list(),
    enabled: isLab,
  })

  const { data: arbreProlab } = useQuery({
    queryKey: ['catalogue-arbre', 'quote-pick'],
    queryFn: () => catalogueApi.arbre(),
    enabled: isLab && prolabPick !== null,
  })

  const { data: addrForm } = useQuery({
    queryKey: ['client-addresses', form.client_id],
    queryFn: () => clientAddressesApi.list(form.client_id),
    enabled: isLab && form.client_id > 0,
  })

  const { data: clientContactsData = [] } = useQuery({
    queryKey: ['client-contacts', form.client_id],
    queryFn: () => clientContactsApi.list(form.client_id),
    enabled: isLab && form.client_id > 0,
  })

  const { data: tplQuote } = useQuery({
    queryKey: ['document-pdf-templates', 'quote'],
    queryFn: () => documentPdfTemplatesApi.list('quote'),
    enabled: isLab,
  })

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['commercial-offerings-picker', catalogDebounced],
    queryFn: () => commercialOfferingsApi.list({ search: catalogDebounced.trim() || undefined, active_only: true, per_page: 80 }),
    enabled: catalogPick !== null,
  })

  useEffect(() => {
    const cid = searchParams.get('client_id')
    const sid = searchParams.get('site_id')
    const did = searchParams.get('dossier_id')
    if (isCreate && cid) {
      const n = Number(cid)
      if (!Number.isNaN(n)) setForm((f) => ({ ...f, client_id: n }))
    }
    if (isCreate && sid) {
      const n = Number(sid)
      if (!Number.isNaN(n)) {
        setForm((f) => ({ ...f, site_id: n, contextMode: 'chantier' }))
      }
    }
    if (isCreate && did) {
      const n = Number(did)
      if (!Number.isNaN(n)) {
        setForm((f) => ({ ...f, contextMode: 'dossier', dossier_id: n }))
        void (async () => {
          const d = await dossiersApi.get(n)
          setForm((f) => ({
            ...f,
            dossier_id: d.id,
            client_id: d.client_id,
            site_id: d.site_id,
            contextMode: 'dossier',
          }))
        })()
      }
    }
  }, [isCreate, searchParams])

  useEffect(() => {
    if (!quote || isCreate) return
    if (quote.status !== 'draft') {
      navigate('/devis', { replace: true })
      return
    }
    const ql = quote.quote_lines ?? []
    const defaultTva = Number(quote.tva_rate ?? 20)
    const lines: QuoteLineDraft[] = ql.map((l) => ({
      row_key: l.id != null ? `line-${l.id}` : newLineRowKey(),
      commercial_offering_id: l.commercial_offering_id ?? undefined,
      ref_article_id: l.ref_article_id ?? undefined,
      ref_package_id: l.ref_package_id ?? undefined,
      description: l.description,
      quantity: l.quantity,
      unit_price: Number(l.unit_price),
      tva_rate: Number(l.tva_rate ?? quote.tva_rate ?? 20),
      discount_percent: Number(l.discount_percent ?? 0),
      part_of_package: false,
    }))
    const baseMeta: EntityMetaPayload = { ...((quote.meta as EntityMetaPayload) ?? {}) }
    const devisJalons = (baseMeta.devis_jalons ?? []).map((j, i) => ({
      ...j,
      id: j.id ?? `j-${i}-${Date.now()}`,
      ref_article_id: j.ref_article_id ?? null,
      commercial_offering_id: j.commercial_offering_id ?? null,
    }))
    baseMeta.devis_jalons = devisJalons
    if (!baseMeta.devis_parcours || baseMeta.devis_parcours.length === 0) {
      baseMeta.devis_parcours = buildDefaultDevisParcours(lines, devisJalons)
    }
    setForm({
      contextMode: inferContextMode(quote),
      client_id: quote.client_id,
      contact_id: quote.contact_id ?? undefined,
      site_id: quote.site_id,
      dossier_id: quote.dossier_id ?? undefined,
      quote_date: quote.quote_date?.slice(0, 10) ?? '',
      order_date: quote.order_date?.slice(0, 10) ?? '',
      site_delivery_date: quote.site_delivery_date?.slice(0, 10) ?? '',
      valid_until: quote.valid_until?.slice(0, 10) ?? '',
      tva_rate: defaultTva,
      discount_percent: Number(quote.discount_percent ?? 0),
      discount_amount: Number(quote.discount_amount ?? 0),
      shipping_amount_ht: Number(quote.shipping_amount_ht ?? 0),
      shipping_tva_rate: Number(quote.shipping_tva_rate ?? 20),
      travel_fee_ht: Number(quote.travel_fee_ht ?? 0),
      travel_fee_tva_rate: Number(quote.travel_fee_tva_rate ?? 20),
      apply_site_travel: false,
      billing_address_id: quote.billing_address_id,
      delivery_address_id: quote.delivery_address_id,
      pdf_template_id: quote.pdf_template_id,
      notes: quote.notes ?? '',
      lines,
      meta: baseMeta,
    })
  }, [quote, isCreate, navigate])

  const createMutation = useMutation({
    mutationFn: (body: QuoteCreateBody) => quotesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      navigate('/devis')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: QuoteCreateBody }) => quotesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', editingNumericId] })
      navigate('/devis')
    },
  })

  const clients = Array.isArray(clientsData) ? clientsData : []
  const allSites = Array.isArray(allSitesData) ? allSitesData : []
  const sitesForClient = useMemo(
    () => (form.client_id > 0 ? allSites.filter((s) => s.client_id === form.client_id) : []),
    [allSites, form.client_id],
  )
  const clientContacts = Array.isArray(clientContactsData) ? clientContactsData : []
  const addressesForm = addrForm ?? []
  const quoteTemplates = tplQuote?.data ?? []
  const dossiers = Array.isArray(dossiersData) ? dossiersData : []

  const travelForTotals = useMemo(() => {
    if (form.apply_site_travel && form.site_id) {
      const s = allSites.find((x) => x.id === form.site_id)
      if (s && Number(s.travel_fee_quote_ht ?? 0) > 0) {
        return { ht: Number(s.travel_fee_quote_ht), tva: form.travel_fee_tva_rate ?? 20 }
      }
    }
    return { ht: form.travel_fee_ht ?? 0, tva: form.travel_fee_tva_rate ?? 20 }
  }, [allSites, form.apply_site_travel, form.site_id, form.travel_fee_ht, form.travel_fee_tva_rate])

  const documentTotals = useMemo(
    () =>
      computeQuoteFormDocumentTotals(
        form.lines,
        form.tva_rate ?? 20,
        form.discount_percent ?? 0,
        form.discount_amount ?? 0,
        form.shipping_amount_ht ?? 0,
        form.shipping_tva_rate ?? 20,
        travelForTotals.ht,
        travelForTotals.tva,
      ),
    [
      form.lines,
      form.tva_rate,
      form.discount_percent,
      form.discount_amount,
      form.shipping_amount_ht,
      form.shipping_tva_rate,
      travelForTotals.ht,
      travelForTotals.tva,
    ],
  )

  const clientLabel = useMemo(
    () =>
      form.client_id > 0
        ? clients.find((c) => c.id === form.client_id)?.name?.trim() || `Client #${form.client_id}`
        : '—',
    [clients, form.client_id],
  )
  const siteLabel = useMemo(() => {
    if (!form.site_id) return '—'
    const s = allSites.find((x) => x.id === form.site_id) ?? sitesForClient.find((x) => x.id === form.site_id)
    return s?.name?.trim() || `Chantier #${form.site_id}`
  }, [allSites, sitesForClient, form.site_id])
  const dossierLabel = useMemo(() => {
    if (!form.dossier_id) return '—'
    const d = dossiers.find((x) => x.id === form.dossier_id)
    return d ? `${d.reference} — ${d.titre}`.trim() : `Dossier #${form.dossier_id}`
  }, [dossiers, form.dossier_id])

  const metaFraisTtc = useMemo(
    () => sumFraisSupplementairesTtc(form.meta.frais_supplementaires),
    [form.meta.frais_supplementaires],
  )

  const addLine = () => {
    setForm((f) => {
      const newLine = emptyLine(f.tva_rate ?? 20)
      const key = newLine.row_key!
      const nextLines = [...f.lines, newLine]
      const base =
        f.meta.devis_parcours && f.meta.devis_parcours.length > 0
          ? f.meta.devis_parcours
          : getEffectiveDevisParcours(f.lines, f.meta)
      return {
        ...f,
        lines: nextLines,
        meta: { ...f.meta, devis_parcours: [...base, { kind: 'ligne' as const, id: key }] },
      }
    })
  }

  const updateLine = (index: number, field: keyof QuoteLineDraft, value: string | number | null | boolean) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }))
  }

  const removeLine = (index: number) => {
    setForm((f) => {
      const removed = f.lines[index]
      const lineKey = removed ? lineKeyForRow(removed, index) : null
      const nextLines = f.lines.filter((_, i) => i !== index)
      const prevM = f.meta.ligne_masque_prix_pdf
      const nextM = prevM ? prevM.filter((_, i) => i !== index) : undefined
      const meta: EntityMetaPayload = { ...f.meta }
      if (nextM && nextM.length > 0) {
        if (nextM.some(Boolean)) meta.ligne_masque_prix_pdf = nextM
        else delete meta.ligne_masque_prix_pdf
      }
      if (lineKey) {
        const p = f.meta.devis_parcours ?? getEffectiveDevisParcours(f.lines, f.meta)
        const nextP = filterDevisParcoursRemoveLigne(p, lineKey)
        if (nextP.length > 0) {
          meta.devis_parcours = nextP
        } else {
          delete meta.devis_parcours
        }
      }
      return { ...f, lines: nextLines, meta }
    })
  }

  function applyOfferingToLine(index: number, o: CommercialOffering) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) =>
        i === index
          ? {
              ...l,
              commercial_offering_id: o.id,
              ref_article_id: undefined,
              ref_package_id: undefined,
              description: o.name,
              unit_price: Number(o.sale_price_ht),
              tva_rate: Number(o.default_tva_rate),
            }
          : l,
      ),
    }))
    setCatalogPick(null)
    setCatalogSearch('')
  }

  function applyOfferingToJalon(jalonIndex: number, o: CommercialOffering) {
    setForm((f) => {
      const list = [...(f.meta.devis_jalons ?? [])]
      if (!list[jalonIndex]) return f
      list[jalonIndex] = {
        ...list[jalonIndex],
        commercial_offering_id: o.id,
        ref_article_id: null,
      }
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
    setCatalogPick(null)
    setCatalogSearch('')
  }

  function applyProlabArticleToLine(index: number, art: RefArticleRow) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) =>
        i === index
          ? {
              ...l,
              commercial_offering_id: null,
              ref_package_id: undefined,
              ref_article_id: art.id,
              description: art.libelle,
              unit_price: Number(art.prix_unitaire_ht),
              tva_rate: Number(art.tva_rate),
            }
          : l,
      ),
    }))
    setProlabPick(null)
    setProlabFamilleId('')
  }

  function applyProlabArticleToJalon(jalonIndex: number, art: RefArticleRow) {
    setForm((f) => {
      const list = [...(f.meta.devis_jalons ?? [])]
      if (!list[jalonIndex]) return f
      list[jalonIndex] = {
        ...list[jalonIndex],
        commercial_offering_id: null,
        ref_article_id: art.id,
      }
      return { ...f, meta: { ...f.meta, devis_jalons: list } }
    })
    setProlabPick(null)
    setProlabFamilleId('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.client_id <= 0) return
    const body = toApiBody(form)
    if (isCreate) {
      createMutation.mutate({
        ...body,
        valid_until: form.valid_until || undefined,
        order_date: form.order_date || undefined,
        site_delivery_date: form.site_delivery_date || undefined,
        site_id: form.site_id || undefined,
        dossier_id: form.dossier_id,
        billing_address_id: form.billing_address_id || undefined,
        delivery_address_id: form.delivery_address_id || undefined,
        pdf_template_id: form.pdf_template_id || undefined,
        apply_site_travel: form.apply_site_travel || undefined,
      })
    } else if (editingNumericId) {
      updateMutation.mutate({
        id: editingNumericId,
        body: {
          ...body,
          valid_until: form.valid_until || undefined,
          order_date: form.order_date || undefined,
          site_delivery_date: form.site_delivery_date || undefined,
          site_id: form.site_id || undefined,
          dossier_id: form.dossier_id,
          billing_address_id: form.billing_address_id || undefined,
          delivery_address_id: form.delivery_address_id || undefined,
          pdf_template_id: form.pdf_template_id || undefined,
          apply_site_travel: form.apply_site_travel || undefined,
        },
      })
    }
  }

  const catalogRows = useMemo(() => catalogData?.data ?? [], [catalogData])

  const prolabFamilles: RefFamilleArticleRow[] = arbreProlab ?? []
  const prolabArticles: RefArticleRow[] = useMemo(() => {
    if (prolabFamilleId === '') return []
    const f = prolabFamilles.find((x) => x.id === prolabFamilleId)
    return f?.articles?.filter((a) => a.actif) ?? []
  }, [prolabFamilleId, prolabFamilles])

  if (!isLab) {
    return (
      <div className="container">
        <p>Accès réservé au laboratoire.</p>
      </div>
    )
  }

  if (!isCreate && loadingQuote) {
    return (
      <div className="container">
        <p>Chargement du devis…</p>
      </div>
    )
  }

  return (
    <div className="container quote-editor-page">
      <PageBackNav back={{ to: '/devis', label: 'Liste des devis' }} />
      <h1>{isCreate ? 'Nouveau devis' : `Modifier le devis ${quote?.number ?? ''}`}</h1>
      <p className="text-muted" style={{ maxWidth: '48rem' }}>
        Aucune ligne d’article au départ. Le <strong>contexte</strong> (client, chantier, dates, contact, modèle PDF) est
        en tête. Les onglets <strong>Lignes, Frais, Tarif & conditions, Aperçu</strong> regroupent l’édition. Les totaux
        (alignés recalcul serveur) et l’enregistrement restent en barre basse.
      </p>

      <form
        onSubmit={handleSubmit}
        className="card quote-editor-page__form"
      >
        <QuoteFormFields
          form={form}
          setForm={setForm}
          clients={clients}
          clientContacts={clientContacts}
          allSites={allSites}
          sitesForClient={sitesForClient}
          dossiers={dossiers}
          addresses={addressesForm}
          quoteTemplates={quoteTemplates}
          addLine={addLine}
          updateLine={updateLine}
          removeLine={removeLine}
          totals={documentTotals}
          clientLabel={clientLabel}
          siteLabel={siteLabel}
          dossierLabel={dossierLabel}
          onOpenCommercialCatalog={(i) => {
            setCatalogPick({ target: 'line', index: i })
            setCatalogSearch('')
          }}
          onOpenProlabCatalog={(i) => {
            setProlabPick({ target: 'line', index: i })
            setProlabFamilleId('')
          }}
          onOpenCommercialCatalogForJalon={(ji) => {
            setCatalogPick({ target: 'jalon', jalonIndex: ji })
            setCatalogSearch('')
          }}
          onOpenProlabCatalogForJalon={(ji) => {
            setProlabPick({ target: 'jalon', jalonIndex: ji })
            setProlabFamilleId('')
          }}
        />

        {(createMutation.isError || updateMutation.isError) && (
          <p className="error" style={{ marginTop: '1rem' }}>{((createMutation.error ?? updateMutation.error) as Error).message}</p>
        )}

        <QuoteFooterSticky
          totals={documentTotals}
          metaFraisTtc={metaFraisTtc}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          submitLabel={isCreate ? 'Créer le devis' : 'Enregistrer'}
          onCancel={() => navigate('/devis')}
        />
      </form>

      {catalogPick !== null && (
        <Modal
          title={catalogPick.target === 'jalon' ? 'Offre (jalon de devis)' : 'Catalogue commercial (offre)'}
          onClose={() => setCatalogPick(null)}
        >
          <input
            type="search"
            placeholder="Filtrer…"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
          {catalogLoading ? (
            <p>Chargement…</p>
          ) : (
            <div className="catalog-picker-list">
              {catalogRows.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="catalog-picker-row"
                  onClick={() => {
                    if (!catalogPick) return
                    if (catalogPick.target === 'line') applyOfferingToLine(catalogPick.index, o)
                    else applyOfferingToJalon(catalogPick.jalonIndex, o)
                  }}
                >
                  <span className="catalog-picker-row__name">{o.name}</span>
                  <span className="catalog-picker-row__meta">
                    {o.code ? `${o.code} · ` : ''}
                    PV {formatMoney(Number(o.sale_price_ht))} (HT) · TVA {Number(o.default_tva_rate).toFixed(2)} %
                  </span>
                </button>
              ))}
              {catalogRows.length === 0 && <p className="text-muted">Aucun résultat. Gérez le catalogue dans le back-office.</p>}
            </div>
          )}
        </Modal>
      )}

      {prolabPick !== null && (
        <Modal
          title={prolabPick.target === 'jalon' ? 'Article PROLAB (jalon de devis)' : 'Catalogue PROLAB (famille → produit)'}
          onClose={() => setProlabPick(null)}
        >
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Sélectionnez d’abord la famille, puis l’article. Les libellés et prix proviennent de l’arbre importé (PROLAB).
          </p>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Famille / catégorie</label>
            <select
              value={prolabFamilleId === '' ? '' : String(prolabFamilleId)}
              onChange={(e) => setProlabFamilleId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Choisir…</option>
              {prolabFamilles.map((fam) => (
                <option key={fam.id} value={fam.id}>
                  {fam.libelle} ({fam.code})
                </option>
              ))}
            </select>
          </div>
          {prolabFamilleId !== '' && (
            <div className="form-group" style={{ maxHeight: 320, overflow: 'auto' }}>
              {prolabArticles.length === 0 && <p className="text-muted">Aucun article actif dans cette famille.</p>}
              {prolabArticles.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="catalog-picker-row"
                  onClick={() => {
                    if (!prolabPick) return
                    if (prolabPick.target === 'line') applyProlabArticleToLine(prolabPick.index, a)
                    else applyProlabArticleToJalon(prolabPick.jalonIndex, a)
                  }}
                >
                  <span className="catalog-picker-row__name">{a.libelle}</span>
                  <span className="catalog-picker-row__meta">
                    {a.code} · {formatMoney(Number(a.prix_unitaire_ht))} (HT) · TVA {Number(a.tva_rate).toFixed(2)} %
                  </span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
