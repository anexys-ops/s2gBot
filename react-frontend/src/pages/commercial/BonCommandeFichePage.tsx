import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, ordresMissionApi, type BonCommandeLigne } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import CommercialDocumentActions from '../../components/crm/CommercialDocumentActions'
import Toast, { toastErrorMessage, type ToastVariant } from '../../components/Toast'
import StatusBadge, { bonCommandeStatutBadgeProps, bonLivraisonStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import EntityAttachmentsPanel from '../../components/attachments/EntityAttachmentsPanel'
import ClientContactPicker from '../../components/clients/ClientContactPicker'
import {
  buildBcLigneDisplayRows,
  filterForfaitBcLigneIds,
  filterForfaitBcLignes,
  isForfaitBcJalon,
  isForfaitBcLigne,
  resolveDevisDisplayMeta,
  resolveQuantiteDevis,
} from '../../lib/bcLigneDisplay'
import { formatAppDate, formatMoney, formatQuantity, MONEY_UNIT_LABEL } from '../../lib/appLocale'
const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

function qtyInputFromApi(q: string | number | null | undefined): string {
  if (q == null || q === '') return '0'
  const n = Number(q)
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n))
  return String(n)
}

function prixInputFromApi(p: string | number | null | undefined): string {
  if (p == null || p === '') return '0'
  const n = Number(p)
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n))
  return String(Math.round(n * 10000) / 10000)
}

function applyMassQtyToLignes(
  lignes: BonCommandeLigne[],
  rawMassQty: string,
  setQtyEdits: Dispatch<SetStateAction<Record<number, string>>>,
  onInvalid: () => void,
  onApplied: () => void,
) {
  const raw = rawMassQty.trim()
  if (!raw || lignes.length === 0) return
  const qty = Number(raw.replace(',', '.'))
  if (!Number.isFinite(qty) || qty < 0) {
    onInvalid()
    return
  }
  onApplied()
  setQtyEdits((prev) => {
    const next = { ...prev }
    for (const l of lignes) {
      next[l.id] = qtyInputFromApi(qty)
    }
    return next
  })
}

type BcJalonQtyMassProps = {
  jalonLabel: string
  value: string
  lineCount: number
  onChange: (value: string) => void
  onApply: () => void
}

function BcJalonQtyMass({ jalonLabel, value, lineCount, onChange, onApply }: BcJalonQtyMassProps) {
  return (
    <div className="bc-jalon-qty-mass">
      <label className="bc-jalon-qty-mass__field">
        <span className="bc-jalon-qty-mass__label">Qté</span>
        <input
          type="number"
          className="bc-lignes-table__qty-input bc-jalon-qty-mass__input"
          min={0}
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Quantité en masse pour le jalon ${jalonLabel}`}
        />
      </label>
      <button
        type="button"
        className="btn btn-secondary btn-sm bc-jalon-qty-mass__apply"
        disabled={!value.trim() || lineCount === 0}
        onClick={onApply}
      >
        Appliquer ({lineCount})
      </button>
    </div>
  )
}

export default function BonCommandeFichePage() {
  const { id } = useParams<{ id: string }>()
  const bcId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const lab = isLab(user?.role)

  const [notes, setNotes] = useState('')
  const [contactId, setContactId] = useState<number | null>(null)
  const [qtyEdits, setQtyEdits] = useState<Record<number, string>>({})
  const [prixEdits, setPrixEdits] = useState<Record<number, string>>({})
  const [confirmAction, setConfirmAction] = useState<'confirmer' | 'bl' | null>(null)
  const [planningToast, setPlanningToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [jalonMassQty, setJalonMassQty] = useState<Record<string, string>>({})

  const { data: bc, isLoading, error } = useQuery({
    queryKey: ['bon-commande', bcId],
    queryFn: () => bonsCommandeApi.get(bcId),
    enabled: Number.isFinite(bcId) && bcId > 0,
  })

  useEffect(() => {
    if (!bc) return
    setNotes(typeof bc.notes === 'string' ? bc.notes : '')
    setContactId(bc.contact_id ?? null)
  }, [bc?.id])

  const serverLignesKey = useMemo(
    () =>
      (bc?.lignes ?? [])
        .map((l) => [l.id, qtyInputFromApi(l.quantite), String(l.prix_unitaire_ht)].join(':'))
        .join('|'),
    [bc?.lignes],
  )

  useEffect(() => {
    if (!bc?.lignes?.length) {
      setQtyEdits({})
      setPrixEdits({})
      return
    }
    const nextQty: Record<number, string> = {}
    const nextPrix: Record<number, string> = {}
    for (const l of bc.lignes) {
      const useDevisQty =
        Number(l.quantite) === 0 &&
        l.quantite_devis != null &&
        Number(l.quantite_devis) > 0
      nextQty[l.id] = useDevisQty ? qtyInputFromApi(l.quantite_devis) : qtyInputFromApi(l.quantite)
      nextPrix[l.id] = prixInputFromApi(l.prix_unitaire_ht)
    }
    setQtyEdits(nextQty)
    setPrixEdits(nextPrix)
  }, [bc?.id, serverLignesKey])

  const mutUpdate = useMutation({
    mutationFn: () => bonsCommandeApi.update(bcId, { notes: notes || undefined, contact_id: contactId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
    },
  })

  const mutConfirmer = useMutation({
    mutationFn: () => bonsCommandeApi.confirmer(bcId),
    onSuccess: () => {
      setConfirmAction(null)
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
    },
  })

  const devisDisplayMeta = useMemo(() => resolveDevisDisplayMeta(bc), [bc])
  const forfaitLignes = useMemo(
    () => filterForfaitBcLignes(bc?.lignes ?? [], devisDisplayMeta),
    [bc?.lignes, devisDisplayMeta],
  )

  const mutQuantites = useMutation({
    mutationFn: async (edits: { qty: Record<number, string>; prix: Record<number, string> }) => {
      if (!forfaitLignes.length) return
      for (const l of forfaitLignes) {
        const body: { quantite?: number; prix_unitaire_ht?: number } = {}
        const rawQty = edits.qty[l.id]
        if (rawQty !== undefined) {
          const qty = Number(String(rawQty).replace(',', '.'))
          if (!Number.isFinite(qty) || qty < 0) {
            throw new Error(`Quantité invalide pour « ${l.libelle} ».`)
          }
          if (Math.abs(qty - Number(l.quantite)) >= 1e-9) {
            body.quantite = qty
          }
        }
        const rawPrix = edits.prix[l.id]
        if (rawPrix !== undefined) {
          const prix = Number(String(rawPrix).replace(',', '.'))
          if (!Number.isFinite(prix) || prix < 0) {
            throw new Error(`Prix invalide pour « ${l.libelle} ».`)
          }
          if (Math.abs(prix - Number(l.prix_unitaire_ht)) >= 1e-9) {
            body.prix_unitaire_ht = prix
          }
        }
        if (Object.keys(body).length > 0) {
          await bonsCommandeApi.updateLigne(bcId, l.id, body)
        }
      }
    },
    onSuccess: () => {
      setPlanningToast({ message: 'Lignes enregistrées.', variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
    },
    onError: (err) => {
      setPlanningToast({
        message: toastErrorMessage(err, "Échec de l'enregistrement des lignes."),
        variant: 'error',
      })
    },
  })

  const mutBl = useMutation({
    mutationFn: () => bonsCommandeApi.transformerBl(bcId),
    onSuccess: (bl) => {
      setConfirmAction(null)
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
      if (bl?.id) navigate(`/bons-livraison/${bl.id}`)
    },
  })

  const mutGenerateOm = useMutation({
    mutationFn: () => ordresMissionApi.generateFromBC(bcId),
    onSuccess: (created) => {
      setPlanningToast({
        message: `${created.length} ordre(s) de mission généré(s) — visible(s) dans OdM terrain, tâches et planning.`,
        variant: 'success',
      })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
    },
    onError: (err) => {
      setPlanningToast({
        message: toastErrorMessage(err, 'Impossible de générer les ordres de mission.'),
        variant: 'error',
      })
    },
  })

  const ligneCount = bc?.lignes?.length ?? 0

  const ligneById = useMemo(
    () => new Map((bc?.lignes ?? []).map((l) => [l.id, l])),
    [bc?.lignes],
  )

  function applyJalonMassQty(jalonId: string, ligneIds: number[]) {
    const editableIds = filterForfaitBcLigneIds(ligneIds, ligneById, devisDisplayMeta)
    const lignes = editableIds
      .map((id) => ligneById.get(id))
      .filter((l): l is BonCommandeLigne => l != null)
    applyMassQtyToLignes(
      lignes,
      jalonMassQty[jalonId] ?? '',
      setQtyEdits,
      () => setPlanningToast({ message: 'Quantité en masse invalide.', variant: 'error' }),
      () => mutQuantites.reset(),
    )
  }
  const ligneDisplayRows = useMemo(
    () => buildBcLigneDisplayRows(bc?.lignes ?? [], devisDisplayMeta),
    [bc?.lignes, devisDisplayMeta],
  )
  const qtyDirty = useMemo(() => {
    if (!forfaitLignes.length) return false
    return forfaitLignes.some((l) => {
      const rawQty = qtyEdits[l.id]
      if (rawQty !== undefined) {
        const n = Number(String(rawQty).replace(',', '.'))
        if (!Number.isFinite(n)) return true
        if (Math.abs(n - Number(l.quantite)) >= 1e-9) return true
      }
      const rawPrix = prixEdits[l.id]
      if (rawPrix !== undefined) {
        const p = Number(String(rawPrix).replace(',', '.'))
        if (!Number.isFinite(p)) return true
        if (Math.abs(p - Number(l.prix_unitaire_ht)) >= 1e-9) return true
      }
      return false
    })
  }, [forfaitLignes, qtyEdits, prixEdits])
  const previewTotals = useMemo(() => {
    if (!bc?.lignes?.length) return null
    let ht = 0
    let tva = 0
    for (const l of bc.lignes) {
      const rawQty = qtyEdits[l.id]
      const rawPrix = prixEdits[l.id]
      const qty =
        rawQty !== undefined && Number.isFinite(Number(String(rawQty).replace(',', '.')))
          ? Number(String(rawQty).replace(',', '.'))
          : Number(l.quantite)
      const prix =
        rawPrix !== undefined && Number.isFinite(Number(String(rawPrix).replace(',', '.')))
          ? Number(String(rawPrix).replace(',', '.'))
          : Number(l.prix_unitaire_ht)
      const lineHt = Math.round(qty * prix * 100) / 100
      const rate = Number(l.tva_rate) || 0
      ht += lineHt
      tva += Math.round(lineHt * (rate / 100) * 100) / 100
    }
    return {
      ht: Math.round(ht * 100) / 100,
      tva: Math.round(tva * 100) / 100,
      ttc: Math.round((ht + tva) * 100) / 100,
    }
  }, [bc?.lignes, qtyEdits, prixEdits])
  const bls = bc?.bons_livraison ?? []
  const statutBadge = useMemo(
    () => (bc ? bonCommandeStatutBadgeProps(bc.statut) : null),
    [bc?.statut],
  )

  const shellProps = {
    shellClassName: 'module-shell--crm' as const,
    moduleBarLabel: 'Commercial — Bon de commande',
  }

  if (!Number.isFinite(bcId) || bcId <= 0) {
    return <p className="error">Identifiant invalide.</p>
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        {...shellProps}
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de commande', to: '/bons-commande' },
          { label: '…' },
        ]}
        title="Chargement…"
      >
        <p className="text-muted">Chargement du bon de commande…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !bc) {
    return (
      <ModuleEntityShell
        {...shellProps}
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de commande', to: '/bons-commande' },
          { label: 'Erreur' },
        ]}
        title="Introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Accès refusé.'}</p>
      </ModuleEntityShell>
    )
  }

  const isAdmin = user?.role === 'lab_admin'
  const canConfirmer = lab && bc.statut === 'brouillon'
  const canGenerateBl = lab && (bc.statut === 'confirme' || bc.statut === 'en_cours' || bc.statut === 'livre')
  const canGenerateOm = lab && isAdmin && (bc.statut === 'confirme' || bc.statut === 'en_cours' || bc.statut === 'livre')
  const hasBonLivraison = (bc.bons_livraison?.length ?? 0) > 0
  const canEditQuantites = lab && forfaitLignes.length > 0 && bc.statut !== 'annule'

  function saveQuantites() {
    setPlanningToast(null)
    mutQuantites.reset()
    mutQuantites.mutate({ qty: qtyEdits, prix: prixEdits })
  }

  const saveQuantitesButton =
    canEditQuantites ? (
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={saveQuantites}
        disabled={mutQuantites.isPending || !qtyDirty}
      >
        {mutQuantites.isPending ? 'Enregistrement…' : 'Enregistrer les lignes'}
      </button>
    ) : null

  return (
    <ModuleEntityShell
      {...shellProps}
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Bons de commande', to: '/bons-commande' },
        { label: bc.numero },
      ]}
      title={`Bon de commande ${bc.numero}`}
      subtitle={
        <span className="bc-fiche__subtitle">
          {statutBadge ? (
            <StatusBadge variant={statutBadge.variant} size="sm">
              {statutBadge.label}
            </StatusBadge>
          ) : null}
          {bc.client?.name ? (
            <Link to={`/clients/${bc.client_id}`} className="link-inline">
              {bc.client.name}
            </Link>
          ) : null}
          {bc.dossier ? (
            <Link to={`/dossiers/${bc.dossier_id}/bc-bl`} className="link-inline">
              {bc.dossier.reference} — {bc.dossier.titre}
            </Link>
          ) : (
            <Link to={`/dossiers/${bc.dossier_id}/bc-bl`} className="link-inline">
              Dossier #{bc.dossier_id}
            </Link>
          )}
        </span>
      }
      actions={
        lab ? (
          <div className="bc-fiche__header-actions">
            <CommercialDocumentActions
              documentType="bon_commande"
              entityId={bc.id}
              entityLabel={bc.numero}
              status={bc.statut}
              isLab={lab}
              isAdmin={isAdmin}
              hasBonLivraison={hasBonLivraison}
              onDeleted={() => navigate('/bons-commande')}
              onStatusChanged={() => {
                void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
              }}
              onCancelled={() => {
                void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
              }}
            />
            {canConfirmer ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setConfirmAction('confirmer')}
                disabled={mutConfirmer.isPending}
              >
                Confirmer le BC
              </button>
            ) : null}
            {canGenerateBl ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmAction('bl')}
                disabled={mutBl.isPending}
              >
                Générer un BL
              </button>
            ) : null}
            {canGenerateOm ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPlanningToast(null)
                  mutGenerateOm.mutate()
                }}
                disabled={mutGenerateOm.isPending}
              >
                {mutGenerateOm.isPending ? 'Génération OdM…' : 'Générer OdM terrain'}
              </button>
            ) : null}
            {canGenerateOm ? (
              <Link to={`/ordres-mission?bon_commande_id=${bc.id}`} className="btn btn-secondary btn-sm">
                Voir OdM
              </Link>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="bc-fiche">
        <section className="card bc-fiche__summary" aria-label="Synthèse du bon de commande">
          <div className="bc-fiche__summary-grid">
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Date commande</span>
              <span className="bc-fiche__summary-value">{formatAppDate(bc.date_commande)}</span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Livraison prévue</span>
              <span className="bc-fiche__summary-value">
                {bc.date_livraison_prevue ? formatAppDate(bc.date_livraison_prevue) : '—'}
              </span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Montant HT</span>
              <span className="bc-fiche__summary-value bc-fiche__summary-value--amount">
                {formatMoney(Number(bc.montant_ht))}
              </span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Montant TTC</span>
              <span className="bc-fiche__summary-value bc-fiche__summary-value--amount">
                {formatMoney(Number(bc.montant_ttc))}
              </span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">TVA</span>
              <span className="bc-fiche__summary-value">{bc.tva_rate} %</span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Devis d&apos;origine</span>
              <span className="bc-fiche__summary-value">
                {bc.quote_id ? (
                  <Link to={`/devis/${bc.quote_id}/editer`} className="link-inline">
                    {bc.quote?.number ?? `Devis #${bc.quote_id}`}
                  </Link>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Contact client</span>
              <span className="bc-fiche__summary-value">
                {bc.clientContact
                  ? `${[bc.clientContact.prenom, bc.clientContact.nom].filter(Boolean).join(' ')}${
                      bc.clientContact.poste ? ` — ${bc.clientContact.poste}` : ''
                    }`
                  : '—'}
              </span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Lignes</span>
              <span className="bc-fiche__summary-value">{ligneCount}</span>
            </div>
          </div>
        </section>

        <div className="bc-fiche__layout">
          <div className="bc-fiche__main">
            <section className="card dossier-tab-panel dossier-tab-panel--table">
              <div className="dossier-tab-panel__header">
                <div className="bc-fiche__lines-header">
                  <div>
                    <h2 className="ds-form-section__title">Lignes de commande</h2>
                    <p className="dossier-tab-panel__intro">
                      Prestations et articles repris du devis source ({MONEY_UNIT_LABEL}).
                      {canEditQuantites
                        ? ' Quantités et prix unitaires des lignes forfait sont modifiables. Application en masse par jalon possible.'
                        : null}
                    </p>
                  </div>
                  {saveQuantitesButton}
                </div>
              </div>

              {ligneCount === 0 ? (
                <p className="dossier-tab-empty">Aucune ligne sur ce bon de commande.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table data-table--compact bc-lignes-table bc-lignes-table--qty-edit">
                    <colgroup>
                      <col className="bc-lignes-table__col-libelle" />
                      <col className="bc-lignes-table__col-qty" />
                      <col className="bc-lignes-table__col-qty" />
                      <col className="bc-lignes-table__col-money" />
                      <col className="bc-lignes-table__col-tva" />
                      <col className="bc-lignes-table__col-money" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Libellé</th>
                        <th scope="col" className="data-table__num">
                          Qté devis
                        </th>
                        <th scope="col" className="data-table__num">
                          Qté BC
                        </th>
                        <th scope="col" className="data-table__num">
                          PU HT ({MONEY_UNIT_LABEL})
                        </th>
                        <th scope="col" className="data-table__num">
                          TVA
                        </th>
                        <th scope="col" className="data-table__num">
                          Montant HT ({MONEY_UNIT_LABEL})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ligneDisplayRows.map((row) => {
                        if (row.type === 'jalon_header') {
                          const editableJalonIds = filterForfaitBcLigneIds(
                            row.ligneIds,
                            ligneById,
                            devisDisplayMeta,
                          )
                          const showJalonMassQty =
                            canEditQuantites &&
                            isForfaitBcJalon(row.jalonId, devisDisplayMeta) &&
                            editableJalonIds.length > 0
                          return (
                            <tr key={row.key} className="bc-lignes-table__jalon">
                              <td className="bc-lignes-table__jalon-label">
                                {row.code ? (
                                  <>
                                    <span className="bc-lignes-table__jalon-code">{row.code}</span>
                                    {' — '}
                                  </>
                                ) : null}
                                {row.label}
                              </td>
                              <td className="data-table__num bc-lignes-table__qty-devis" aria-hidden="true">
                                —
                              </td>
                              <td colSpan={4} className="data-table__num bc-lignes-table__jalon-mass">
                                {showJalonMassQty ? (
                                  <BcJalonQtyMass
                                    jalonLabel={row.label}
                                    value={jalonMassQty[row.jalonId] ?? ''}
                                    lineCount={editableJalonIds.length}
                                    onChange={(value) =>
                                      setJalonMassQty((prev) => ({ ...prev, [row.jalonId]: value }))
                                    }
                                    onApply={() => applyJalonMassQty(row.jalonId, row.ligneIds)}
                                  />
                                ) : null}
                              </td>
                            </tr>
                          )
                        }
                        const l = row.ligne
                        const isForfaitLine = isForfaitBcLigne(l, devisDisplayMeta)
                        const canEditQty = canEditQuantites && isForfaitLine
                        const maxDevis = resolveQuantiteDevis(l)
                        const rawQty = qtyEdits[l.id] ?? qtyInputFromApi(l.quantite)
                        const rawPrix = prixEdits[l.id] ?? prixInputFromApi(l.prix_unitaire_ht)
                        const previewQty = Number(String(rawQty).replace(',', '.'))
                        const previewPrix = Number(String(rawPrix).replace(',', '.'))
                        const lineHt =
                          Number.isFinite(previewQty) && previewQty >= 0 && Number.isFinite(previewPrix)
                            ? Math.round(previewQty * previewPrix * 100) / 100
                            : Number(l.montant_ht)
                        return (
                          <tr
                            key={row.key}
                            className={row.nested ? 'bc-lignes-table__product--nested' : undefined}
                          >
                            <td>{l.libelle}</td>
                            <td className="data-table__num bc-lignes-table__qty-devis">
                              {maxDevis != null ? formatQuantity(maxDevis) : '—'}
                            </td>
                            <td className="data-table__num bc-lignes-table__qty-cell">
                              {canEditQty ? (
                                <div className="bc-lignes-table__qty-editor">
                                  <input
                                    type="number"
                                    className="bc-lignes-table__qty-input"
                                    min={0}
                                    step="any"
                                    inputMode="decimal"
                                    value={rawQty}
                                    onChange={(e) => {
                                      mutQuantites.reset()
                                      setQtyEdits((s) => ({ ...s, [l.id]: e.target.value }))
                                    }}
                                    aria-label={`Quantité BC pour ${l.libelle}`}
                                  />
                                  {maxDevis != null ? (
                                    <span className="bc-lignes-table__qty-cap text-muted">
                                      devis : {formatQuantity(maxDevis)}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                formatQuantity(l.quantite)
                              )}
                            </td>
                            <td className="data-table__num bc-lignes-table__prix-cell">
                              {canEditQty ? (
                                <input
                                  type="number"
                                  className="bc-lignes-table__qty-input"
                                  min={0}
                                  step="any"
                                  inputMode="decimal"
                                  value={rawPrix}
                                  onChange={(e) => {
                                    mutQuantites.reset()
                                    setPrixEdits((s) => ({ ...s, [l.id]: e.target.value }))
                                  }}
                                  aria-label={`Prix unitaire HT pour ${l.libelle}`}
                                />
                              ) : (
                                formatMoney(Number(l.prix_unitaire_ht))
                              )}
                            </td>
                            <td className="data-table__num bc-lignes-table__tva-cell">
                              {Number(l.tva_rate) > 0 ? `${Number(l.tva_rate)} %` : '—'}
                            </td>
                            <td className="data-table__num">{formatMoney(lineHt)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="data-table__foot-label">
                          Total HT{qtyDirty ? ' (aperçu)' : ''}
                        </td>
                        <td className="data-table__num data-table__foot-value">
                          {formatMoney(previewTotals?.ht ?? Number(bc.montant_ht))}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="data-table__foot-label">
                          TVA{qtyDirty ? ' (aperçu)' : ''}
                        </td>
                        <td className="data-table__num data-table__foot-value">
                          {formatMoney(
                            previewTotals?.tva ??
                              (Number(bc.montant_ttc) - Number(bc.montant_ht)),
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="data-table__foot-label">
                          Total TTC{qtyDirty ? ' (aperçu)' : ''}
                        </td>
                        <td className="data-table__num data-table__foot-value">
                          {formatMoney(previewTotals?.ttc ?? Number(bc.montant_ttc))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {mutQuantites.isError ? (
                <p className="error bc-fiche__qty-error">{(mutQuantites.error as Error).message}</p>
              ) : null}
            </section>
          </div>

          <aside className="bc-fiche__aside">
            {lab ? (
              <section className="card bc-fiche__aside-panel">
                <h2 className="ds-form-section__title">Contact commercial</h2>
                <ClientContactPicker
                  clientId={bc.client_id}
                  value={contactId}
                  onChange={(cid) => setContactId(cid)}
                  label="Contact sur le BC"
                  contactType="commercial"
                />
                <div className="bc-fiche__aside-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => mutUpdate.mutate()}
                    disabled={mutUpdate.isPending}
                  >
                    {mutUpdate.isPending ? 'Enregistrement…' : 'Enregistrer le contact'}
                  </button>
                </div>
                {mutUpdate.isError ? (
                  <p className="error">{(mutUpdate.error as Error).message}</p>
                ) : null}
              </section>
            ) : null}

            {lab ? (
              <section className="card bc-fiche__aside-panel">
                <h2 className="ds-form-section__title">Notes internes</h2>
                <label className="form-group">
                  Notes laboratoire
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Consignes, suivi, remarques…"
                  />
                </label>
                <div className="bc-fiche__aside-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => mutUpdate.mutate()}
                    disabled={mutUpdate.isPending}
                  >
                    {mutUpdate.isPending ? 'Enregistrement…' : 'Enregistrer les notes'}
                  </button>
                </div>
              </section>
            ) : null}

            {bls.length > 0 ? (
              <section className="card bc-fiche__aside-panel">
                <h2 className="ds-form-section__title">Bons de livraison liés</h2>
                <ul className="bc-fiche__bl-list">
                  {bls.map((bl) => {
                    const st = bonLivraisonStatutBadgeProps(bl.statut)
                    return (
                      <li key={bl.id} className="bc-fiche__bl-item">
                        <Link to={`/bons-livraison/${bl.id}`} className="link-inline">
                          <code className="code-badge">{bl.numero}</code>
                        </Link>
                        <StatusBadge variant={st.variant} size="sm">
                          {st.label}
                        </StatusBadge>
                        <span className="text-muted">{formatAppDate(bl.date_livraison)}</span>
                      </li>
                    )
                  })}
                </ul>
                {mutBl.data?.id ? (
                  <p className="text-muted bc-fiche__bl-created">
                    Dernier BL créé :{' '}
                    <Link to={`/bons-livraison/${mutBl.data.id}`} className="link-inline">
                      {mutBl.data.numero}
                    </Link>
                  </p>
                ) : null}
              </section>
            ) : null}

            <EntityAttachmentsPanel
              attachableType="bon_commande"
              attachableId={bc.id}
              canUpload={lab}
              canDelete={isAdmin}
              intro="Contrats signés, confirmations client, plans…"
            />

            {lab ? (
              <ExtrafieldsForm
                entityType="bon_commande"
                entityId={bc.id}
                canEdit
                title="Champs personnalisés"
              />
            ) : null}
          </aside>
        </div>
      </div>

      {confirmAction === 'confirmer' ? (
        <ConfirmDialog
          title="Confirmer le bon de commande"
          message={
            <>
              Confirmer le bon <strong>{bc.numero}</strong> ? Il pourra ensuite être transformé en bon de
              livraison.
            </>
          }
          confirmLabel="Confirmer"
          loading={mutConfirmer.isPending}
          error={mutConfirmer.isError ? (mutConfirmer.error as Error).message : null}
          onConfirm={() => mutConfirmer.mutate()}
          onCancel={() => {
            if (!mutConfirmer.isPending) setConfirmAction(null)
          }}
        />
      ) : null}

      {confirmAction === 'bl' ? (
        <ConfirmDialog
          title="Générer un bon de livraison"
          message={
            <>
              Créer un bon de livraison (BLC) à partir du BC <strong>{bc.numero}</strong> ?
            </>
          }
          confirmLabel="Générer le BL"
          loading={mutBl.isPending}
          error={mutBl.isError ? (mutBl.error as Error).message : null}
          onConfirm={() => mutBl.mutate()}
          onCancel={() => {
            if (!mutBl.isPending) setConfirmAction(null)
          }}
        />
      ) : null}

      {planningToast ? (
        <Toast
          message={planningToast.message}
          variant={planningToast.variant}
          onClose={() => setPlanningToast(null)}
        />
      ) : null}
    </ModuleEntityShell>
  )
}
