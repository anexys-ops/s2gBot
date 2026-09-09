/**
 * OrdreMissionFichePage
 *
 * Fiche détaillée d'un ordre de mission :
 *  - Infos générales + changement de statut
 *  - Tableau des lignes (avec assignation utilisateur / machine)
 *  - Frais de déplacement (pour OMs technicien)
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsersApi, ordresMissionApi, type FraisDeplacement, type OrdreMission, type OrdreMissionLigne, type User } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import OmLigneAddPanel from '../../components/ordres-mission/OmLigneAddPanel'
import SaveButton from '../../components/ds/SaveButton'
import StatusBadge, { ordreMissionStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import { dateInputFromApi, formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import {
  ordreMissionBonCommande,
  ordreMissionDossier,
  ordreMissionDossierId,
  ordreMissionQuote,
} from '../../lib/ordreMissionDisplay'

const TYPE_META: Record<string, { label: string; color: string }> = {
  labo: { label: 'Laboratoire', color: '#10b981' },
  technicien: { label: 'Techniciens', color: '#f59e0b' },
  ingenieur: { label: 'Ingénieurs', color: '#3b82f6' },
}

const STATUTS = ['brouillon', 'planifie', 'en_cours', 'termine', 'annule'] as const
const STATUTS_LIGNE = ['a_faire', 'en_cours', 'realise', 'annule'] as const

type OmDraft = {
  statut: OrdreMission['statut']
  responsable_id: number | null
}

type LigneDraft = {
  assigned_user_id: number | null
  date_prevue: string
  statut: OrdreMissionLigne['statut']
}

function buildDraftsFromOm(om: OrdreMission): { omDraft: OmDraft; ligneDrafts: Record<number, LigneDraft> } {
  const ligneDrafts: Record<number, LigneDraft> = {}
  for (const ligne of om.lignes ?? []) {
    ligneDrafts[ligne.id] = {
      assigned_user_id: ligne.assigned_user_id ?? null,
      date_prevue: dateInputFromApi(ligne.date_prevue),
      statut: ligne.statut,
    }
  }
  return {
    omDraft: {
      statut: om.statut,
      responsable_id: om.responsable_id ?? null,
    },
    ligneDrafts,
  }
}

function computeIsDirty(om: OrdreMission, omDraft: OmDraft, ligneDrafts: Record<number, LigneDraft>): boolean {
  if (omDraft.statut !== om.statut) return true
  if (omDraft.responsable_id !== (om.responsable_id ?? null)) return true
  for (const ligne of om.lignes ?? []) {
    const draft = ligneDrafts[ligne.id]
    if (!draft) continue
    if (draft.assigned_user_id !== (ligne.assigned_user_id ?? null)) return true
    if (draft.date_prevue !== dateInputFromApi(ligne.date_prevue)) return true
    if (draft.statut !== ligne.statut) return true
  }
  return false
}

export default function OrdreMissionFichePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const omId = Number(id)
  const [showAddLigne, setShowAddLigne] = useState(false)
  const [deleteLigneTarget, setDeleteLigneTarget] = useState<OrdreMissionLigne | null>(null)

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

  const { data: frais = [] } = useQuery({
    queryKey: ['ordre-mission-frais', omId],
    queryFn: () => ordresMissionApi.fraisList(omId),
    enabled: om?.type === 'technicien',
    staleTime: 30_000,
  })

  const { data: usersRaw } = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => adminUsersApi.list(),
    staleTime: 120_000,
  })
  const users: User[] = Array.isArray(usersRaw) ? usersRaw : (usersRaw?.data ?? [])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!om || !omDraft) return
      const omBody: Parameters<typeof ordresMissionApi.update>[1] = {}
      if (omDraft.statut !== om.statut) omBody.statut = omDraft.statut
      if (omDraft.responsable_id !== (om.responsable_id ?? null)) {
        omBody.responsable_id = omDraft.responsable_id ?? undefined
      }
      if (Object.keys(omBody).length > 0) {
        await ordresMissionApi.update(omId, omBody)
      }
      for (const ligne of om.lignes ?? []) {
        const draft = ligneDrafts[ligne.id]
        if (!draft) continue
        const body: Partial<OrdreMissionLigne> = {}
        if (draft.assigned_user_id !== (ligne.assigned_user_id ?? null)) {
          body.assigned_user_id = draft.assigned_user_id
        }
        if (draft.date_prevue !== dateInputFromApi(ligne.date_prevue)) {
          body.date_prevue = draft.date_prevue || null
        }
        if (draft.statut !== ligne.statut) body.statut = draft.statut
        if (Object.keys(body).length > 0) {
          await ordresMissionApi.updateLigne(omId, ligne.id, body)
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
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

  // Frais de déplacement
  const [showFraisForm, setShowFraisForm] = useState(false)
  const [fraisForm, setFraisForm] = useState({ user_id: '', date: '', lieu_depart: '', lieu_arrivee: '', distance_km: '', taux_km: '0.4010', type_transport: 'voiture', notes: '' })

  const createFraisMut = useMutation({
    mutationFn: () => ordresMissionApi.fraisCreate(omId, {
      user_id: Number(fraisForm.user_id),
      date: fraisForm.date,
      lieu_depart: fraisForm.lieu_depart || undefined,
      lieu_arrivee: fraisForm.lieu_arrivee || undefined,
      distance_km: Number(fraisForm.distance_km),
      taux_km: Number(fraisForm.taux_km),
      type_transport: fraisForm.type_transport,
      notes: fraisForm.notes || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission-frais', omId] })
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
      setShowFraisForm(false)
      setFraisForm({ user_id: '', date: '', lieu_depart: '', lieu_arrivee: '', distance_km: '', taux_km: '0.4010', type_transport: 'voiture', notes: '' })
    },
  })

  const deleteFraisMut = useMutation({
    mutationFn: (fraisId: number) => ordresMissionApi.fraisDelete(omId, fraisId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission-frais', omId] })
      void qc.invalidateQueries({ queryKey: ['expense-reports'] })
    },
  })

  const deleteLigneMut = useMutation({
    mutationFn: (ligneId: number) => ordresMissionApi.deleteLigne(omId, ligneId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
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
  const totalFrais = frais.reduce((s, f) => s + f.montant, 0)
  const expenseReportId = frais[0]?.expense_report_id
  const expenseReportNumber = frais[0]?.expense_report_number
  const statutBadge = ordreMissionStatutBadgeProps(omDraft.statut)

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
              onChange={(e) =>
                setOmDraft((prev) =>
                  prev ? { ...prev, statut: e.target.value as OmDraft['statut'] } : prev,
                )
              }
              disabled={saveMut.isPending}
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
              {om.date_prevue ? formatAppDate(om.date_prevue) : '—'}
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
        {om.notes ? <p className="om-fiche__notes">{om.notes}</p> : null}
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
                void qc.invalidateQueries({ queryKey: ['terrain-tasks'] })
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
                {om.type === 'labo' && <th>Équipement</th>}
                <th>Date prévue</th>
                <th>Statut</th>
                {isLab ? <th className="data-table__actions">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(om.lignes ?? []).map((ligne) => {
                const draft = ligneDrafts[ligne.id]
                if (!draft) return null
                return (
                  <tr key={ligne.id}>
                    <td>
                      <div>{ligne.libelle}</div>
                      {ligne.articleAction && <small className="text-muted">{ligne.articleAction.duree_heures}h estimé</small>}
                    </td>
                    <td>
                      {ligne.article ? (
                        <Link to={`/catalogue/articles/${ligne.article.id}`} className="link-inline">
                          <code className="code-badge">{ligne.article.code}</code>
                          {' '}
                          {ligne.article.libelle}
                        </Link>
                      ) : ligne.ref_article_id ? (
                        <Link to={`/catalogue/articles/${ligne.ref_article_id}`} className="link-inline">
                          Produit #{ligne.ref_article_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{ligne.quantite}</td>
                    <td>
                      <select
                        value={draft.assigned_user_id ?? ''}
                        onChange={(e) =>
                          updateLigneDraft(ligne.id, {
                            assigned_user_id: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        disabled={saveMut.isPending}
                        style={{ fontSize: '0.82rem', minWidth: 120 }}
                      >
                        <option value="">—</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </td>
                    {om.type === 'labo' && (
                      <td>
                        {ligne.equipment ? (
                          <Link to={`/materiel/equipements/${ligne.equipment.id}`} className="link-inline">
                            {[ligne.equipment.code, ligne.equipment.name].filter(Boolean).join(' — ')}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    <td>
                      <input
                        type="date"
                        value={draft.date_prevue}
                        onChange={(e) => updateLigneDraft(ligne.id, { date_prevue: e.target.value })}
                        disabled={saveMut.isPending}
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
                        disabled={saveMut.isPending}
                        style={{ fontSize: '0.82rem' }}
                      >
                        {STATUTS_LIGNE.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    {isLab ? (
                      <td className="data-table__actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          disabled={deleteLigneMut.isPending}
                          onClick={() => setDeleteLigneTarget(ligne)}
                        >
                          Supprimer
                        </button>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {(om.lignes ?? []).length === 0 && <p style={{ padding: '1rem' }} className="text-muted">Aucune ligne.</p>}
      </div>

      {/* Notes de frais — déplacement (technicien uniquement) */}
      {om.type === 'technicien' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Notes de frais — déplacement</span>
              {frais.length > 0 && <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>Total : {formatMoney(totalFrais)}</span>}
              {expenseReportId ? (
                <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
                  Liée à la NDF{' '}
                  <Link to={`/notes-de-frais/${expenseReportId}`} className="link-inline">
                    {expenseReportNumber ?? `#${expenseReportId}`}
                  </Link>
                  {' '}— validation dans Terrain → Notes de frais
                </p>
              ) : null}
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowFraisForm((v) => !v)}>+ Ajouter</button>
          </div>

          {showFraisForm && (
            <form
              style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
              onSubmit={(e) => { e.preventDefault(); createFraisMut.mutate() }}
            >
              <div className="quote-form-grid">
                <label>
                  Technicien *
                  <select value={fraisForm.user_id} onChange={(e) => setFraisForm((f) => ({ ...f, user_id: e.target.value }))} required>
                    <option value="">Choisir…</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
                <label>
                  Date *
                  <input type="date" value={fraisForm.date} onChange={(e) => setFraisForm((f) => ({ ...f, date: e.target.value }))} required />
                </label>
                <label>
                  Départ
                  <input value={fraisForm.lieu_depart} onChange={(e) => setFraisForm((f) => ({ ...f, lieu_depart: e.target.value }))} placeholder="Ville départ" />
                </label>
                <label>
                  Arrivée
                  <input value={fraisForm.lieu_arrivee} onChange={(e) => setFraisForm((f) => ({ ...f, lieu_arrivee: e.target.value }))} placeholder="Ville arrivée" />
                </label>
                <label>
                  Distance aller (km) *
                  <input type="number" min={0} step="0.1" value={fraisForm.distance_km} onChange={(e) => setFraisForm((f) => ({ ...f, distance_km: e.target.value }))} required />
                </label>
                <label>
                  Taux {MONEY_UNIT_LABEL}/km
                  <input type="number" min={0} step="0.0001" value={fraisForm.taux_km} onChange={(e) => setFraisForm((f) => ({ ...f, taux_km: e.target.value }))} />
                </label>
              </div>
              {fraisForm.distance_km && fraisForm.taux_km && (
                <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                  Montant estimé (A/R) : <strong>{formatMoney(Number(fraisForm.distance_km) * Number(fraisForm.taux_km) * 2)}</strong>
                </p>
              )}
              <div className="crud-actions" style={{ marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={createFraisMut.isPending}>Enregistrer</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFraisForm(false)}>Annuler</button>
              </div>
            </form>
          )}

          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Technicien</th>
                  <th>Date</th>
                  <th>Trajet</th>
                  <th>Distance</th>
                  <th>Montant A/R</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {frais.map((f: FraisDeplacement) => (
                  <tr key={f.id}>
                    <td>{f.user?.name ?? `#${f.user_id}`}</td>
                    <td>{new Date(f.date).toLocaleDateString('fr-FR')}</td>
                    <td>{[f.lieu_depart, f.lieu_arrivee].filter(Boolean).join(' → ') || '—'}</td>
                    <td>{f.distance_km} km</td>
                    <td><strong>{formatMoney(f.montant)}</strong></td>
                    <td><span className="badge">{f.ndf_statut ?? f.statut}</span></td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => { if (window.confirm('Supprimer ?')) deleteFraisMut.mutate(f.id) }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {frais.length === 0 && !showFraisForm && (
            <p style={{ padding: '1rem' }} className="text-muted">
              Aucune ligne de déplacement. Chaque saisie crée ou complète la note de frais (NDF) de l’OM.
            </p>
          )}
        </div>
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
