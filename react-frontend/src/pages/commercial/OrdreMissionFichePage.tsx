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
import { formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import StatusBadge, { ordreMissionStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { dateInputFromApi } from '../../lib/appLocale'

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
  const omId = Number(id)

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
      setShowFraisForm(false)
      setFraisForm({ user_id: '', date: '', lieu_depart: '', lieu_arrivee: '', distance_km: '', taux_km: '0.4010', type_transport: 'voiture', notes: '' })
    },
  })

  const deleteFraisMut = useMutation({
    mutationFn: (fraisId: number) => ordresMissionApi.fraisDelete(omId, fraisId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ordre-mission-frais', omId] }),
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
  const totalFrais = frais.reduce((s, f) => s + f.montant, 0)
  const statutBadge = ordreMissionStatutBadgeProps(omDraft.statut)

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Ordres de mission', to: '/ordres-mission' },
        { label: om.numero },
      ]}
      moduleBarLabel="Commercial — Ordre de mission"
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
          <Link to="/ordres-mission" className="btn btn-secondary btn-sm">
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!isDirty || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
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

      {/* Infos générales */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="info-grid">
          <div>
            <span className="info-label">Client</span>
            <span>{om.client?.name ?? `#${om.client_id}`}</span>
          </div>
          <div>
            <span className="info-label">Bon de commande</span>
            <span>
              {om.bonCommande
                ? <Link to={`/bons-commande/${om.bon_commande_id}`} className="link-inline">{om.bonCommande.numero}</Link>
                : '—'}
            </span>
          </div>
          <div>
            <span className="info-label">Site</span>
            <span>{om.site?.name ?? '—'}</span>
          </div>
          <div>
            <span className="info-label">Date prévue</span>
            <span>{om.date_prevue ? new Date(om.date_prevue).toLocaleDateString('fr-FR') : '—'}</span>
          </div>
          <div>
            <span className="info-label">Responsable</span>
            <span>
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
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">— Non assigné —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </span>
          </div>
        </div>
        {om.notes && <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{om.notes}</p>}
      </div>

      {/* Lignes */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
          Tâches ({om.lignes?.length ?? 0})
        </div>
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
                    <td>{ligne.article ? `${ligne.article.code} — ${ligne.article.libelle}` : '—'}</td>
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
                      <td>{ligne.equipment ? `${ligne.equipment.code ?? ''} ${ligne.equipment.name}` : '—'}</td>
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {(om.lignes ?? []).length === 0 && <p style={{ padding: '1rem' }} className="text-muted">Aucune ligne.</p>}
      </div>

      {/* Frais de déplacement (technicien uniquement) */}
      {om.type === 'technicien' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Frais de déplacement</span>
              {frais.length > 0 && <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>Total : {formatMoney(totalFrais)}</span>}
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
                    <td><span className="badge">{f.statut}</span></td>
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
          {frais.length === 0 && !showFraisForm && <p style={{ padding: '1rem' }} className="text-muted">Aucun frais de déplacement.</p>}
        </div>
      )}
    </ModuleEntityShell>
  )
}
