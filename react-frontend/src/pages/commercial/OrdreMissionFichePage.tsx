/**
 * OrdreMissionFichePage
 *
 * Fiche détaillée d'un ordre de mission :
 *  - Infos générales + changement de statut
 *  - Tableau des lignes (avec assignation utilisateur / machine)
 *  - Frais de déplacement (pour OMs technicien)
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsersApi, ordresMissionApi, type FraisDeplacement, type OrdreMissionLigne, type User } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const TYPE_META: Record<string, { label: string; color: string }> = {
  labo:       { label: 'Laboratoire', color: '#10b981' },
  technicien: { label: 'Techniciens', color: '#f59e0b' },
  ingenieur:  { label: 'Ingénieurs',  color: '#3b82f6' },
}

const STATUTS = ['brouillon', 'planifie', 'en_cours', 'termine', 'annule'] as const
const STATUTS_LIGNE = ['a_faire', 'en_cours', 'realise', 'annule'] as const

export default function OrdreMissionFichePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const omId = Number(id)

  const { data: om, isLoading, error } = useQuery({
    queryKey: ['ordre-mission', omId],
    queryFn: () => ordresMissionApi.get(omId),
    staleTime: 30_000,
  })

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

  const updateOmMut = useMutation({
    mutationFn: (body: Parameters<typeof ordresMissionApi.update>[1]) => ordresMissionApi.update(omId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] }),
  })

  const updateLigneMut = useMutation({
    mutationFn: ({ ligneId, body }: { ligneId: number; body: Partial<OrdreMissionLigne> }) =>
      ordresMissionApi.updateLigne(omId, ligneId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ordre-mission', omId] }),
  })

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

  if (isLoading) return <div className="container">Chargement…</div>
  if (error || !om) return <div className="container error">Ordre de mission introuvable.</div>

  const typeMeta = TYPE_META[om.type] ?? { label: om.type, color: '#6b7280' }
  const totalFrais = frais.reduce((s, f) => s + f.montant, 0)

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Ordres de mission', to: '/ordres-mission' },
        { label: om.numero },
      ]}
      moduleBarLabel="Commercial — Ordre de mission"
      title={om.numero}
      subtitle={
        <span style={{ color: typeMeta.color, fontWeight: 600 }}>{typeMeta.label}</span>
      }
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={om.statut}
            onChange={(e) => updateOmMut.mutate({ statut: e.target.value as typeof STATUTS[number] })}
            style={{ fontSize: '0.85rem' }}
          >
            {STATUTS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      }
    >
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
                value={om.responsable_id ?? ''}
                onChange={(e) => updateOmMut.mutate({ responsable_id: e.target.value ? Number(e.target.value) : undefined })}
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
              {(om.lignes ?? []).map((ligne) => (
                <tr key={ligne.id}>
                  <td>
                    <div>{ligne.libelle}</div>
                    {ligne.articleAction && <small className="text-muted">{ligne.articleAction.duree_heures}h estimé</small>}
                  </td>
                  <td>{ligne.article ? `${ligne.article.code} — ${ligne.article.libelle}` : '—'}</td>
                  <td>{ligne.quantite}</td>
                  <td>
                    <select
                      value={ligne.assigned_user_id ?? ''}
                      onChange={(e) => updateLigneMut.mutate({ ligneId: ligne.id, body: { assigned_user_id: e.target.value ? Number(e.target.value) : null } })}
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
                      value={ligne.date_prevue ? ligne.date_prevue.slice(0, 10) : ''}
                      onChange={(e) => updateLigneMut.mutate({ ligneId: ligne.id, body: { date_prevue: e.target.value || null } })}
                      style={{ fontSize: '0.82rem' }}
                    />
                  </td>
                  <td>
                    <select
                      value={ligne.statut}
                      onChange={(e) => updateLigneMut.mutate({ ligneId: ligne.id, body: { statut: e.target.value as OrdreMissionLigne['statut'] } })}
                      style={{ fontSize: '0.82rem' }}
                    >
                      {STATUTS_LIGNE.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
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
              {frais.length > 0 && <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>Total : {totalFrais.toFixed(2)} €</span>}
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
                  Taux €/km
                  <input type="number" min={0} step="0.0001" value={fraisForm.taux_km} onChange={(e) => setFraisForm((f) => ({ ...f, taux_km: e.target.value }))} />
                </label>
              </div>
              {fraisForm.distance_km && fraisForm.taux_km && (
                <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                  Montant estimé (A/R) : <strong>{(Number(fraisForm.distance_km) * Number(fraisForm.taux_km) * 2).toFixed(2)} €</strong>
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
                    <td><strong>{f.montant.toFixed(2)} €</strong></td>
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
