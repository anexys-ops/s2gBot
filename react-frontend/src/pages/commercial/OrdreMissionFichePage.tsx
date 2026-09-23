/**
 * OrdreMissionFichePage
 *
 * Fiche détaillée d'un ordre de mission :
 *  - Infos générales + changement de statut
 *  - Tableau des lignes (avec assignation utilisateur / machine)
 *  - Frais de déplacement (pour OMs technicien)
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsersApi, bonsCommandeApi, equipmentsApi, ordresMissionApi, type EquipmentRow, type OrdreMission, type OrdreMissionLigne, type User } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import OmExpensePanel from '../../components/ordres-mission/OmExpensePanel'
import OmLigneAddPanel from '../../components/ordres-mission/OmLigneAddPanel'
import OmAvailabilityPanel from '../../components/ordres-mission/OmAvailabilityPanel'
import SaveButton from '../../components/ds/SaveButton'
import StatusBadge, { ordreMissionStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import CentreGroupField from '../../components/centres/CentreGroupField'
import { useAuth } from '../../contexts/AuthContext'
import { dateInputFromApi } from '../../lib/appLocale'
import {
  ordreMissionBonCommande,
  ordreMissionDossier,
  ordreMissionDossierId,
  ordreMissionQuote,
} from '../../lib/ordreMissionDisplay'
import { resolveDevisDisplayMeta } from '../../lib/bcLigneDisplay'
import {
  buildOrdreMissionLigneGroups,
  ordreMissionLigneQuantite,
  type OrdreMissionLigneGroup,
} from '../../lib/ordreMissionLigneDisplay'

const TYPE_META: Record<string, { label: string; color: string }> = {
  labo: { label: 'Laboratoire', color: '#10b981' },
  technicien: { label: 'Techniciens', color: '#f59e0b' },
  ingenieur: { label: 'Ingénieurs', color: '#3b82f6' },
}

const STATUTS = ['brouillon', 'planifie', 'en_cours', 'termine', 'annule'] as const
const STATUTS_LIGNE = [
  { value: 'planifie', label: 'Planifié' },
  { value: 'replanifie', label: 'Replanifié' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'freeze', label: 'Freeze' },
  { value: 'annule', label: 'Annulé' },
  { value: 'attente_validation', label: 'Attente validation' },
  { value: 'cloture', label: 'Clôturé' },
] as const

type OmDraft = {
  statut: OrdreMission['statut']
  responsable_id: number | null
  lab_centre_group_id: number | null
  date_prevue: string
  notes: string
}

type LigneDraft = {
  libelle: string
  quantite: string
  assigned_user_id: number | null
  equipment_id: number | null
  date_prevue: string
  statut: OrdreMissionLigne['statut']
}

type BulkLignePatch = Pick<OrdreMissionLigne, 'quantite'> &
  Partial<Pick<OrdreMissionLigne, 'assigned_user_id' | 'date_prevue' | 'statut'>>

type BulkAvailability = {
  ligneId: number
  userId: number
  plannedDate: string
}

function buildDraftsFromOm(om: OrdreMission): { omDraft: OmDraft; ligneDrafts: Record<number, LigneDraft> } {
  const ligneDrafts: Record<number, LigneDraft> = {}
  for (const ligne of om.lignes ?? []) {
    ligneDrafts[ligne.id] = {
      libelle: ligne.libelle,
      quantite: String(ligne.quantite ?? ''),
      assigned_user_id: ligne.assigned_user_id ?? null,
      equipment_id: ligne.equipment_id ?? null,
      date_prevue: dateInputFromApi(ligne.date_prevue),
      statut: ligne.statut,
    }
  }
  return {
    omDraft: {
      statut: om.statut,
      responsable_id: om.responsable_id ?? null,
      lab_centre_group_id: om.lab_centre_group_id ?? null,
      date_prevue: dateInputFromApi(om.date_prevue),
      notes: om.notes ?? '',
    },
    ligneDrafts,
  }
}

function computeIsDirty(om: OrdreMission, omDraft: OmDraft, ligneDrafts: Record<number, LigneDraft>): boolean {
  if (omDraft.responsable_id !== (om.responsable_id ?? null)) return true
  if (omDraft.lab_centre_group_id !== (om.lab_centre_group_id ?? null)) return true
  if (omDraft.date_prevue !== dateInputFromApi(om.date_prevue)) return true
  if (omDraft.notes !== (om.notes ?? '')) return true
  for (const ligne of om.lignes ?? []) {
    const draft = ligneDrafts[ligne.id]
    if (!draft) continue
    if (draft.libelle !== ligne.libelle) return true
    if (Number(draft.quantite) !== Number(ligne.quantite)) return true
    if (draft.assigned_user_id !== (ligne.assigned_user_id ?? null)) return true
    if (draft.equipment_id !== (ligne.equipment_id ?? null)) return true
    if (draft.date_prevue !== dateInputFromApi(ligne.date_prevue)) return true
    if (draft.statut !== ligne.statut) return true
  }
  return false
}

function JalonBulkControls({
  group,
  users,
  pending,
  onApply,
  onPreview,
}: {
  group: OrdreMissionLigneGroup
  users: User[]
  pending: boolean
  onApply: (patch: BulkLignePatch) => void
  onPreview: (userId: number, plannedDate: string) => void
}) {
  const [quantite, setQuantite] = useState('1')
  const [assignedUserId, setAssignedUserId] = useState<number | ''>('')
  const [plannedDate, setPlannedDate] = useState('')
  const [statut, setStatut] = useState<OrdreMissionLigne['statut'] | ''>('')
  const parsedQuantity = Number(quantite)
  const canApply = quantite !== '' && Number.isFinite(parsedQuantity) && parsedQuantity > 0

  function preview(nextUserId = assignedUserId, nextDate = plannedDate) {
    if (nextUserId !== '') onPreview(nextUserId, nextDate)
  }

  return (
    <div className="om-jalon-bulk" aria-label={`Saisie en masse pour ${group.jalon?.label ?? 'le jalon'}`}>
      <label>
        <span>Qté</span>
        <input
          type="number"
          min="0.001"
          step="any"
          value={quantite}
          onChange={(event) => setQuantite(event.target.value)}
          disabled={pending}
          aria-label={`Quantité en masse pour ${group.jalon?.label ?? 'le jalon'}`}
        />
      </label>
      <label>
        <span>Technicien</span>
        <select
          value={assignedUserId}
          onChange={(event) => {
            const nextValue = event.target.value ? Number(event.target.value) : ''
            setAssignedUserId(nextValue)
            preview(nextValue, plannedDate)
          }}
          disabled={pending}
        >
          <option value="">Ne pas modifier</option>
          {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        <span>Date</span>
        <input
          type="date"
          value={plannedDate}
          onChange={(event) => {
            setPlannedDate(event.target.value)
            preview(assignedUserId, event.target.value)
          }}
          disabled={pending}
        />
      </label>
      <label>
        <span>Statut</span>
        <select
          value={statut}
          onChange={(event) => setStatut(event.target.value as OrdreMissionLigne['statut'] | '')}
          disabled={pending}
        >
          <option value="">Ne pas modifier</option>
          {STATUTS_LIGNE.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!canApply || pending}
        onClick={() => {
          const patch: BulkLignePatch = { quantite: parsedQuantity }
          if (assignedUserId !== '') patch.assigned_user_id = assignedUserId
          if (plannedDate) patch.date_prevue = plannedDate
          if (statut) patch.statut = statut
          onApply(patch)
        }}
      >
        {pending ? 'Validation…' : `Valider (${group.lignes.length})`}
      </button>
    </div>
  )
}

export default function OrdreMissionFichePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const omId = Number(id)
  const [showAddLigne, setShowAddLigne] = useState(false)
  const [deleteLigneTarget, setDeleteLigneTarget] = useState<OrdreMissionLigne | null>(null)
  const [availabilityLigneId, setAvailabilityLigneId] = useState<number | null>(null)
  const [bulkAvailability, setBulkAvailability] = useState<BulkAvailability | null>(null)

  const { data: om, isLoading, error } = useQuery({
    queryKey: ['ordre-mission', omId],
    queryFn: () => ordresMissionApi.get(omId),
    staleTime: 30_000,
  })

  const [omDraft, setOmDraft] = useState<OmDraft | null>(null)
  const [ligneDrafts, setLigneDrafts] = useState<Record<number, LigneDraft>>({})

  useEffect(() => {
    if (!om) return
    const built = buildDraftsFromOm(om)
    setOmDraft(built.omDraft)
    setLigneDrafts(built.ligneDrafts)
  }, [omId, om])

  const isDirty = useMemo(() => {
    if (!om || !omDraft) return false
    return computeIsDirty(om, omDraft, ligneDrafts)
  }, [om, omDraft, ligneDrafts])

  const hasInvalidLineQuantity = useMemo(
    () => Object.values(ligneDrafts).some((draft) => {
      const value = Number(draft.quantite)
      return draft.quantite === '' || !Number.isFinite(value) || value <= 0
    }),
    [ligneDrafts],
  )

  const { data: frais = [] } = useQuery({
    queryKey: ['ordre-mission-frais', omId],
    queryFn: () => ordresMissionApi.fraisList(omId),
    enabled: om?.type === 'technicien' || om?.type === 'ingenieur',
    staleTime: 30_000,
  })

  const { data: bonCommande } = useQuery({
    queryKey: ['bon-commande', om?.bon_commande_id],
    queryFn: () => bonsCommandeApi.get(om!.bon_commande_id),
    enabled: Boolean(om?.bon_commande_id),
    staleTime: 30_000,
  })

  const { data: usersRaw } = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => adminUsersApi.list(),
    staleTime: 120_000,
  })
  const users: User[] = Array.isArray(usersRaw) ? usersRaw : (usersRaw?.data ?? [])

  const { data: equipmentsRaw } = useQuery({
    queryKey: ['equipments', 'om-selector'],
    queryFn: () => equipmentsApi.list(),
    staleTime: 120_000,
  })
  const equipments: EquipmentRow[] = equipmentsRaw ?? []

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!om || !omDraft) return
      const omBody: Parameters<typeof ordresMissionApi.update>[1] = {}
      if (omDraft.responsable_id !== (om.responsable_id ?? null)) {
        omBody.responsable_id = omDraft.responsable_id ?? undefined
      }
      if (omDraft.lab_centre_group_id !== (om.lab_centre_group_id ?? null)) {
        omBody.lab_centre_group_id = omDraft.lab_centre_group_id
      }
      if (omDraft.date_prevue !== dateInputFromApi(om.date_prevue)) {
        omBody.date_prevue = omDraft.date_prevue || null
      }
      if (omDraft.notes !== (om.notes ?? '')) omBody.notes = omDraft.notes || null
      if (Object.keys(omBody).length > 0) {
        await ordresMissionApi.update(omId, omBody)
      }
      const lineUpdates: Array<Partial<OrdreMissionLigne> & { id: number }> = []
      for (const ligne of om.lignes ?? []) {
        const draft = ligneDrafts[ligne.id]
        if (!draft) continue
        const body: Partial<OrdreMissionLigne> = {}
        if (draft.libelle !== ligne.libelle) body.libelle = draft.libelle
        if (Number(draft.quantite) !== Number(ligne.quantite)) body.quantite = Number(draft.quantite)
        if (draft.assigned_user_id !== (ligne.assigned_user_id ?? null)) {
          body.assigned_user_id = draft.assigned_user_id
        }
        if (draft.equipment_id !== (ligne.equipment_id ?? null)) body.equipment_id = draft.equipment_id
        if (draft.date_prevue !== dateInputFromApi(ligne.date_prevue)) {
          body.date_prevue = draft.date_prevue || null
        }
        if (draft.statut !== ligne.statut) body.statut = draft.statut
        if (Object.keys(body).length > 0) lineUpdates.push({ id: ligne.id, ...body })
      }
      if (lineUpdates.length > 0) await ordresMissionApi.updateLignes(omId, lineUpdates)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['mission-tasks-list'] })
    },
  })

  const statusMut = useMutation({
    mutationFn: (statut: OmDraft['statut']) => ordresMissionApi.update(omId, { statut }),
    onMutate: (statut) => {
      const previousStatut = omDraft?.statut
      setOmDraft((prev) => (prev ? { ...prev, statut } : prev))
      return { previousStatut }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['mission-tasks-list'] })
    },
    onError: (_error, _statut, context) => {
      if (context?.previousStatut) {
        setOmDraft((prev) => (prev ? { ...prev, statut: context.previousStatut! } : prev))
      }
    },
  })

  function resetDrafts() {
    if (!om) return
    const built = buildDraftsFromOm(om)
    setOmDraft(built.omDraft)
    setLigneDrafts(built.ligneDrafts)
  }

  function updateLigneDraft(ligneId: number, patch: Partial<LigneDraft>) {
    setLigneDrafts((prev) => ({
      ...prev,
      [ligneId]: { ...prev[ligneId], ...patch },
    }))
  }

  function ligneUpdateBody(ligne: OrdreMissionLigne): Partial<OrdreMissionLigne> {
    const draft = ligneDrafts[ligne.id]
    if (!draft) return {}
    const body: Partial<OrdreMissionLigne> = {}
    if (draft.libelle !== ligne.libelle) body.libelle = draft.libelle
    if (Number(draft.quantite) !== Number(ligne.quantite)) body.quantite = Number(draft.quantite)
    if (draft.assigned_user_id !== (ligne.assigned_user_id ?? null)) body.assigned_user_id = draft.assigned_user_id
    if (draft.equipment_id !== (ligne.equipment_id ?? null)) body.equipment_id = draft.equipment_id
    if (draft.date_prevue !== dateInputFromApi(ligne.date_prevue)) body.date_prevue = draft.date_prevue || null
    if (draft.statut !== ligne.statut) body.statut = draft.statut
    return body
  }

  const saveLigneMut = useMutation({
    mutationFn: ({ ligne }: { ligne: OrdreMissionLigne }) =>
      ordresMissionApi.updateLigne(omId, ligne.id, ligneUpdateBody(ligne)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['mission-tasks-list'] })
      void qc.invalidateQueries({ queryKey: ['om-availability'] })
    },
  })

  const saveGroupMut = useMutation({
    mutationFn: ({ group, patch }: { group: OrdreMissionLigneGroup; patch: BulkLignePatch }) =>
      ordresMissionApi.updateLignes(
        omId,
        group.lignes.map((ligne) => ({ id: ligne.id, ...patch })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['mission-tasks-list'] })
      void qc.invalidateQueries({ queryKey: ['om-availability'] })
    },
  })

  const deleteLigneMut = useMutation({
    mutationFn: (ligneId: number) => ordresMissionApi.deleteLigne(omId, ligneId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['mission-tasks-list'] })
      setDeleteLigneTarget(null)
    },
  })

  if (isLoading || !omDraft) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Ordres de mission', to: '/ordres-mission' },
          { label: '…' },
        ]}
        moduleBarLabel="Commercial — Ordre de mission"
        title="Chargement…"
      >
        <p className="text-muted">Chargement…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !om) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Ordres de mission', to: '/ordres-mission' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Commercial — Ordre de mission"
        title="Ordre de mission introuvable"
      >
        <p className="error">Ordre de mission introuvable.</p>
        <Link to="/ordres-mission" className="link-inline">← Retour liste</Link>
      </ModuleEntityShell>
    )
  }

  const typeMeta = TYPE_META[om.type] ?? { label: om.type, color: '#6b7280' }
  const listBackTo =
    om.type === 'labo'
      ? '/ordres-mission?context=labo&type=labo'
      : om.type === 'ingenieur'
        ? '/ordres-mission?context=ingenierie&type=ingenieur'
        : '/ordres-mission?context=terrain&type=technicien'
  const bc = ordreMissionBonCommande(om)
  const quote = ordreMissionQuote(om)
  const dossier = ordreMissionDossier(om)
  const dossierId = ordreMissionDossierId(om)
  const statutBadge = ordreMissionStatutBadgeProps(omDraft.statut)
  const bcLignes = bonCommande?.lignes ?? []
  const bcLignesById = new Map(bcLignes.map((ligne) => [ligne.id, ligne]))
  const ligneGroups = buildOrdreMissionLigneGroups(
    om.lignes ?? [],
    bcLignes,
    resolveDevisDisplayMeta(bonCommande),
  )
  const selectedAvailabilityLigneId = bulkAvailability?.ligneId ?? availabilityLigneId
  const availabilityLigne = (om.lignes ?? []).find((ligne) => ligne.id === selectedAvailabilityLigneId) ?? null
  const availabilityDraft = availabilityLigne ? ligneDrafts[availabilityLigne.id] : null
  const availabilityUserId = bulkAvailability?.userId ?? availabilityDraft?.assigned_user_id ?? null
  const availabilityUser = availabilityUserId
    ? users.find((item) => item.id === availabilityUserId)
    : null
  const availabilityDate = bulkAvailability?.plannedDate ?? availabilityDraft?.date_prevue ?? ''

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Ordres de mission', to: listBackTo },
        { label: om.numero },
      ]}
      moduleBarLabel="Ordre de mission"
      title={om.numero}
      subtitle={
        <div className="om-fiche__title-row">
          <span style={{ color: typeMeta.color, fontWeight: 600 }}>{typeMeta.label}</span>
          <StatusBadge variant={statutBadge.variant} size="sm">
            {statutBadge.label}
          </StatusBadge>
          {isDirty ? <span className="status-pill status-pill--warning">Modifications non enregistrées</span> : null}
        </div>
      }
      actions={
        <div className="crud-actions">
          <Link to={listBackTo} className="btn btn-secondary btn-sm">
            ← Liste
          </Link>
          <label className="om-fiche__statut-select">
            <span className="om-fiche__statut-select-label">Statut</span>
            <select
              value={omDraft.statut}
              onChange={(e) => statusMut.mutate(e.target.value as OmDraft['statut'])}
              disabled={saveMut.isPending || statusMut.isPending}
            >
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {ordreMissionStatutBadgeProps(s).label}
                </option>
              ))}
            </select>
          </label>
          <SaveButton
            isPending={saveMut.isPending}
            isSuccess={saveMut.isSuccess}
            isDirty={isDirty}
            disabled={hasInvalidLineQuantity}
            onClick={() => saveMut.mutate()}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!isDirty || saveMut.isPending}
            onClick={resetDrafts}
          >
            Annuler
          </button>
        </div>
      }
    >
      {saveMut.isError ? (
        <p className="error" style={{ marginBottom: '1rem' }}>
          {(saveMut.error as Error).message}
        </p>
      ) : null}
      {statusMut.isError ? (
        <p className="error" style={{ marginBottom: '1rem' }}>
          {(statusMut.error as Error).message}
        </p>
      ) : null}

      <section className="card bc-fiche__summary om-fiche__summary" aria-label="Informations ordre de mission">
        <div className="bc-fiche__summary-grid">
          <div className="bc-fiche__summary-item">
            <span className="bc-fiche__summary-label">Client</span>
            <span className="bc-fiche__summary-value">
              {om.client_id ? (
                <Link to={`/clients/${om.client_id}/fiche`} className="link-inline">
                  {om.client?.name ?? `#${om.client_id}`}
                </Link>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="bc-fiche__summary-item">
            <span className="bc-fiche__summary-label">Devis</span>
            <span className="bc-fiche__summary-value">
              {quote ? (
                <Link to={`/devis/${quote.id}/editer`} className="link-inline">
                  <code className="code-badge">{quote.number}</code>
                </Link>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="bc-fiche__summary-item">
            <span className="bc-fiche__summary-label">Bon de commande</span>
            <span className="bc-fiche__summary-value">
              {bc ? (
                <Link to={`/bons-commande/${bc.id}`} className="link-inline">
                  <code className="code-badge">{bc.numero}</code>
                </Link>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="bc-fiche__summary-item">
            <span className="bc-fiche__summary-label">Dossier</span>
            <span className="bc-fiche__summary-value">
              {dossierId ? (
                <Link to={`/dossiers/${dossierId}`} className="link-inline">
                  {dossier?.reference ?? dossier?.titre ?? `#${dossierId}`}
                </Link>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="bc-fiche__summary-item">
            <span className="bc-fiche__summary-label">Site / chantier</span>
            <span className="bc-fiche__summary-value">
              {om.site_id ? (
                <Link to={`/sites/${om.site_id}/fiche`} className="link-inline">
                  {om.site?.name ?? `#${om.site_id}`}
                </Link>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="bc-fiche__summary-item">
            <span className="bc-fiche__summary-label">Date prévue</span>
            <span className="bc-fiche__summary-value">
              <input
                type="date"
                value={omDraft.date_prevue}
                onChange={(event) => setOmDraft((current) => current ? { ...current, date_prevue: event.target.value } : current)}
                disabled={saveMut.isPending}
              />
            </span>
          </div>
          <div className="bc-fiche__summary-item">
            <span className="bc-fiche__summary-label">Responsable</span>
            <span className="bc-fiche__summary-value">
              <select
                value={omDraft.responsable_id ?? ''}
                onChange={(e) =>
                  setOmDraft((prev) =>
                    prev
                      ? { ...prev, responsable_id: e.target.value ? Number(e.target.value) : null }
                      : prev,
                  )
                }
                disabled={saveMut.isPending}
                className="om-fiche__inline-select"
              >
                <option value="">— Non assigné —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </div>
        <label className="om-fiche__notes">
          <span className="bc-fiche__summary-label">Notes</span>
          <textarea
            rows={2}
            value={omDraft.notes}
            onChange={(event) => setOmDraft((current) => current ? { ...current, notes: event.target.value } : current)}
            disabled={saveMut.isPending}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        {isLab ? (
          <div style={{ marginTop: '0.75rem', maxWidth: 320 }}>
            <CentreGroupField
              value={omDraft.lab_centre_group_id}
              onChange={(v) =>
                setOmDraft((prev) => (prev ? { ...prev, lab_centre_group_id: v ?? null } : prev))
              }
              disabled={saveMut.isPending}
              label="Agence / Centre"
            />
          </div>
        ) : null}
      </section>

      {/* Lignes */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontWeight: 600 }}>Tâches ({om.lignes?.length ?? 0})</span>
          {isLab ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddLigne((v) => !v)}>
              {showAddLigne ? 'Fermer' : '+ Ajouter une tâche'}
            </button>
          ) : null}
        </div>
        {showAddLigne && isLab ? (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <OmLigneAddPanel
              om={om}
              onClose={() => setShowAddLigne(false)}
              onCreated={() => {
                void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] })
                void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
                void qc.invalidateQueries({ queryKey: ['mission-tasks-list'] })
              }}
            />
          </div>
        ) : null}
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Article</th>
                <th>Qté</th>
                <th>Assigné à</th>
                <th>Équipement</th>
                <th>Date prévue</th>
                <th>Statut</th>
                {isLab ? <th className="data-table__actions">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {ligneGroups.map((group) => (
                <Fragment key={group.key}>
                  {group.jalon ? (
                    <tr className="om-lignes-table__jalon">
                      <td colSpan={isLab ? 8 : 7}>
                        <div className="om-lignes-table__jalon-content">
                          <div className="om-lignes-table__jalon-title">
                            <span className="om-lignes-table__jalon-code">{group.jalon.code}</span>
                            {group.jalon.code ? ' — ' : ''}{group.jalon.label}
                            {group.jalon.quantite != null ? (
                              <span className="om-lignes-table__jalon-qty">Qté BC : {group.jalon.quantite}</span>
                            ) : null}
                          </div>
                          {isLab ? (
                            <JalonBulkControls
                              key={`${group.key}-${group.jalon.quantite ?? ''}`}
                              group={group}
                              users={users}
                              pending={saveGroupMut.isPending && saveGroupMut.variables?.group.key === group.key}
                              onApply={(patch) => saveGroupMut.mutate({ group, patch })}
                              onPreview={(userId, plannedDate) => {
                                const firstLine = group.lignes[0]
                                if (firstLine) setBulkAvailability({ ligneId: firstLine.id, userId, plannedDate })
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {group.lignes.map((ligne) => {
                    const draft = ligneDrafts[ligne.id]
                    if (!draft) return null
                    const ligneDirty = Object.keys(ligneUpdateBody(ligne)).length > 0
                    const quantityValue = Number(draft.quantite)
                    const quantityValid = draft.quantite !== '' && Number.isFinite(quantityValue) && quantityValue > 0
                    const isSavingThisLine = saveLigneMut.isPending && saveLigneMut.variables?.ligne.id === ligne.id
                    return (
                      <tr key={ligne.id} className={group.jalon ? 'om-lignes-table__task--nested' : undefined}>
                        <td>
                          {isLab ? (
                            <input
                              type="text"
                              value={draft.libelle}
                              onChange={(event) => updateLigneDraft(ligne.id, { libelle: event.target.value })}
                              disabled={saveMut.isPending || isSavingThisLine}
                              aria-label={`Libellé pour ${ligne.libelle}`}
                              style={{ minWidth: 180 }}
                            />
                          ) : <div>{ligne.libelle}</div>}
                          {ligne.articleAction && <small className="text-muted">{ligne.articleAction.duree_heures}h estimé</small>}
                        </td>
                        <td className="om-ligne-article-cell">
                          {ligne.article ? (
                            <Link to={`/catalogue/articles/${ligne.article.id}`} className="om-ligne-article-cell__link">
                              <code className="code-badge">{ligne.article.code}</code>
                              <span className="om-ligne-article-cell__libelle">{ligne.article.libelle}</span>
                            </Link>
                          ) : ligne.ref_article_id ? (
                            <Link to={`/catalogue/articles/${ligne.ref_article_id}`} className="link-inline">
                              Produit #{ligne.ref_article_id}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {isLab ? (
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={draft.quantite}
                              onChange={(event) => updateLigneDraft(ligne.id, { quantite: event.target.value })}
                              disabled={saveMut.isPending || isSavingThisLine}
                              className="om-lignes-table__qty-input"
                              aria-label={`Quantité pour ${ligne.libelle}`}
                            />
                          ) : ordreMissionLigneQuantite(ligne, bcLignesById)}
                        </td>
                        <td>
                          <select
                            value={draft.assigned_user_id ?? ''}
                            onFocus={() => {
                              setBulkAvailability(null)
                              setAvailabilityLigneId(ligne.id)
                            }}
                            onChange={(e) => {
                              updateLigneDraft(ligne.id, {
                                assigned_user_id: e.target.value ? Number(e.target.value) : null,
                              })
                              setBulkAvailability(null)
                              setAvailabilityLigneId(ligne.id)
                            }}
                            disabled={saveMut.isPending || isSavingThisLine}
                            style={{ fontSize: '0.82rem', minWidth: 120 }}
                          >
                            <option value="">—</option>
                            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </td>
                        <td>
                          {isLab ? (
                            <select
                              value={draft.equipment_id ?? ''}
                              onChange={(event) => updateLigneDraft(ligne.id, {
                                equipment_id: event.target.value ? Number(event.target.value) : null,
                              })}
                              disabled={saveMut.isPending || isSavingThisLine}
                              style={{ fontSize: '0.82rem', minWidth: 140 }}
                            >
                              <option value="">— Aucun —</option>
                              {equipments.map((equipment) => (
                                <option key={equipment.id} value={equipment.id}>
                                  {[equipment.code, equipment.name].filter(Boolean).join(' — ')}
                                </option>
                              ))}
                            </select>
                          ) : ligne.equipment ? (
                            <Link to={`/materiel/equipements/${ligne.equipment.id}`} className="link-inline">
                              {[ligne.equipment.code, ligne.equipment.name].filter(Boolean).join(' — ')}
                            </Link>
                          ) : '—'}
                        </td>
                        <td>
                          <input
                            type="date"
                            value={draft.date_prevue}
                            onFocus={() => {
                              setBulkAvailability(null)
                              setAvailabilityLigneId(ligne.id)
                            }}
                            onChange={(e) => updateLigneDraft(ligne.id, { date_prevue: e.target.value })}
                            disabled={saveMut.isPending || isSavingThisLine}
                            style={{ fontSize: '0.82rem' }}
                          />
                        </td>
                        <td>
                          <select
                            value={draft.statut}
                            onChange={(e) =>
                              updateLigneDraft(ligne.id, {
                                statut: e.target.value as LigneDraft['statut'],
                              })
                            }
                            disabled={saveMut.isPending || isSavingThisLine}
                            style={{ fontSize: '0.82rem' }}
                          >
                            {STATUTS_LIGNE.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                        </td>
                        {isLab ? (
                          <td className="data-table__actions">
                            <div className="om-lignes-table__actions">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={!ligneDirty || !quantityValid || saveLigneMut.isPending || deleteLigneMut.isPending}
                                onClick={() => saveLigneMut.mutate({ ligne })}
                              >
                                {isSavingThisLine ? 'Validation…' : 'Valider'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-danger-outline"
                                disabled={deleteLigneMut.isPending || saveLigneMut.isPending}
                                onClick={() => setDeleteLigneTarget(ligne)}
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {(om.lignes ?? []).length === 0 && <p style={{ padding: '1rem' }} className="text-muted">Aucune ligne.</p>}
      </div>

      {saveLigneMut.isError ? (
        <p className="error" style={{ margin: '-0.35rem 0 1rem' }}>
          {(saveLigneMut.error as Error).message}
        </p>
      ) : null}

      {saveGroupMut.isError ? (
        <p className="error" style={{ margin: '-0.35rem 0 1rem' }}>
          {(saveGroupMut.error as Error).message}
        </p>
      ) : null}

      {availabilityLigne && availabilityUserId && availabilityUser ? (
        <OmAvailabilityPanel
          key={`${availabilityLigne.id}-${availabilityUserId}`}
          userId={availabilityUserId}
          userName={availabilityUser.name}
          equipment={availabilityLigne.equipment}
          plannedDate={availabilityDate}
        />
      ) : null}

      {(om.type === 'technicien' || om.type === 'ingenieur') && (
        <OmExpensePanel omId={omId} frais={frais} users={users} />
      )}

      {deleteLigneTarget ? (
        <ConfirmDialog
          title="Supprimer la tâche"
          message={
            <>
              Supprimer la tâche <strong>{deleteLigneTarget.libelle}</strong> de cet ordre de mission ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteLigneMut.isPending}
          error={deleteLigneMut.isError ? (deleteLigneMut.error as Error).message : null}
          onConfirm={() => deleteLigneMut.mutate(deleteLigneTarget.id)}
          onCancel={() => {
            if (!deleteLigneMut.isPending) setDeleteLigneTarget(null)
          }}
        />
      ) : null}
    </ModuleEntityShell>
  )
}
