import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, planningTerrainApi, type BonCommandeLigne } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge, { bonCommandeStatutBadgeProps, bonLivraisonStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ClientContactPicker from '../../components/clients/ClientContactPicker'
import { dateInputFromApi, formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

type LignePeriodeEdit = { debut: string; fin: string }
type LigneExtraEdit = { technicien_id: number | null; date_livraison: string; notes_ligne: string }

export default function BonCommandeFichePage() {
  const { id } = useParams<{ id: string }>()
  const bcId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const lab = isLab(user?.role)

  const [notes, setNotes] = useState('')
  const [contactId, setContactId] = useState<number | null>(null)
  const [ligneEdits, setLigneEdits] = useState<Record<number, LignePeriodeEdit>>({})
  const [ligneExtraEdits, setLigneExtraEdits] = useState<Record<number, LigneExtraEdit>>({})
  const [confirmAction, setConfirmAction] = useState<'confirmer' | 'bl' | null>(null)

  const { data: bc, isLoading, error } = useQuery({
    queryKey: ['bon-commande', bcId],
    queryFn: () => bonsCommandeApi.get(bcId),
    enabled: Number.isFinite(bcId) && bcId > 0,
  })

  const { data: techniciens = [] } = useQuery({
    queryKey: ['planning-terrain', 'techniciens'],
    queryFn: () => planningTerrainApi.techniciens(),
    enabled: lab,
    staleTime: 120_000,
  })

  useEffect(() => {
    if (!bc) return
    setNotes(typeof bc.notes === 'string' ? bc.notes : '')
    setContactId(bc.contact_id ?? null)
  }, [bc?.id])

  useEffect(() => {
    if (!bc?.lignes?.length) {
      setLigneEdits({})
      setLigneExtraEdits({})
      return
    }
    const next: Record<number, LignePeriodeEdit> = {}
    const nextExtra: Record<number, LigneExtraEdit> = {}
    for (const l of bc.lignes) {
      const dl = l as BonCommandeLigne
      next[l.id] = {
        debut: dateInputFromApi(dl.date_debut_prevue),
        fin: dateInputFromApi(dl.date_fin_prevue),
      }
      nextExtra[l.id] = {
        technicien_id: dl.technicien_id ?? null,
        date_livraison: dateInputFromApi(dl.date_livraison),
        notes_ligne: dl.notes_ligne ?? '',
      }
    }
    setLigneEdits(next)
    setLigneExtraEdits(nextExtra)
  }, [bc?.id, bc?.lignes])

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

  const mutLignes = useMutation({
    mutationFn: async () => {
      if (!bc?.lignes?.length) return
      for (const l of bc.lignes) {
        const periode = ligneEdits[l.id]
        const extra = ligneExtraEdits[l.id]
        if (!periode && !extra) continue

        const prevD = dateInputFromApi(l.date_debut_prevue)
        const prevF = dateInputFromApi(l.date_fin_prevue)
        const prevLivraison = dateInputFromApi(l.date_livraison)
        const prevNotes = l.notes_ligne ?? ''
        const body: Parameters<typeof bonsCommandeApi.updateLigne>[2] = {}

        if (periode && (periode.debut !== prevD || periode.fin !== prevF)) {
          body.date_debut_prevue = periode.debut || null
          body.date_fin_prevue = periode.fin || null
        }
        if (extra) {
          const extraChanged =
            extra.technicien_id !== (l.technicien_id ?? null) ||
            extra.date_livraison !== prevLivraison ||
            extra.notes_ligne !== prevNotes
          if (extraChanged) {
            body.technicien_id = extra.technicien_id
            body.date_livraison = extra.date_livraison || null
            body.notes_ligne = extra.notes_ligne || null
          }
        }

        if (Object.keys(body).length > 0) {
          await bonsCommandeApi.updateLigne(bcId, l.id, body)
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
      void qc.invalidateQueries({ queryKey: ['planning-terrain'] })
      void qc.invalidateQueries({ queryKey: ['planning-overview'] })
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

  const ligneCount = bc?.lignes?.length ?? 0
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

  const canConfirmer = lab && bc.statut === 'brouillon'
  const canGenerateBl = lab && (bc.statut === 'confirme' || bc.statut === 'en_cours' || bc.statut === 'livre')

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
                <h2 className="ds-form-section__title">Lignes de commande</h2>
                <p className="dossier-tab-panel__intro">
                  Prestations et articles repris du devis source ({MONEY_UNIT_LABEL}).
                </p>
              </div>

              {ligneCount === 0 ? (
                <p className="dossier-tab-empty">Aucune ligne sur ce bon de commande.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table data-table--compact">
                    <thead>
                      <tr>
                        <th>Libellé</th>
                        <th className="data-table__num">Qté</th>
                        <th className="data-table__num">PU HT</th>
                        <th className="data-table__num">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bc.lignes!.map((l) => (
                        <tr key={l.id}>
                          <td>{l.libelle}</td>
                          <td className="data-table__num">{l.quantite}</td>
                          <td className="data-table__num">{formatMoney(Number(l.prix_unitaire_ht))}</td>
                          <td className="data-table__num">{formatMoney(Number(l.montant_ht))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="data-table__foot-label">
                          Total HT
                        </td>
                        <td className="data-table__num data-table__foot-value">
                          {formatMoney(Number(bc.montant_ht))}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="data-table__foot-label">
                          Total TTC
                        </td>
                        <td className="data-table__num data-table__foot-value">
                          {formatMoney(Number(bc.montant_ttc))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {lab && ligneCount > 0 ? (
              <section className="card bc-fiche__planning">
                <div className="bc-fiche__planning-header">
                  <div>
                    <h2 className="ds-form-section__title">Planification terrain</h2>
                    <p className="bc-fiche__planning-intro text-muted">
                      Périodes, technicien et livraison par ligne de commande.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => mutLignes.mutate()}
                    disabled={mutLignes.isPending}
                  >
                    {mutLignes.isPending ? 'Enregistrement…' : 'Enregistrer la planification'}
                  </button>
                </div>

                {mutLignes.isError ? (
                  <p className="error bc-fiche__planning-error">{(mutLignes.error as Error).message}</p>
                ) : null}

                <div className="bc-fiche__ligne-cards">
                  {bc.lignes!.map((l) => (
                    <article key={l.id} className="bc-fiche__ligne-card">
                      <header className="bc-fiche__ligne-card-header">
                        <h3 className="bc-fiche__ligne-card-title">{l.libelle}</h3>
                        <span className="bc-fiche__ligne-card-meta text-muted">
                          Qté {l.quantite} — {formatMoney(Number(l.montant_ht))} HT
                        </span>
                      </header>
                      <div className="bc-fiche__ligne-card-grid">
                        <label className="form-group">
                          Début terrain (prévu)
                          <input
                            type="date"
                            value={ligneEdits[l.id]?.debut ?? ''}
                            onChange={(e) =>
                              setLigneEdits((s) => ({
                                ...s,
                                [l.id]: { ...s[l.id], debut: e.target.value, fin: s[l.id]?.fin ?? '' },
                              }))
                            }
                          />
                        </label>
                        <label className="form-group">
                          Fin terrain (prévu)
                          <input
                            type="date"
                            value={ligneEdits[l.id]?.fin ?? ''}
                            onChange={(e) =>
                              setLigneEdits((s) => ({
                                ...s,
                                [l.id]: { debut: s[l.id]?.debut ?? '', fin: e.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="form-group">
                          Technicien
                          <select
                            value={ligneExtraEdits[l.id]?.technicien_id ?? ''}
                            onChange={(e) =>
                              setLigneExtraEdits((s) => ({
                                ...s,
                                [l.id]: {
                                  ...s[l.id],
                                  technicien_id: e.target.value ? Number(e.target.value) : null,
                                  date_livraison: s[l.id]?.date_livraison ?? '',
                                  notes_ligne: s[l.id]?.notes_ligne ?? '',
                                },
                              }))
                            }
                          >
                            <option value="">— Non assigné —</option>
                            {techniciens.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-group">
                          Date livraison
                          <input
                            type="date"
                            value={ligneExtraEdits[l.id]?.date_livraison ?? ''}
                            onChange={(e) =>
                              setLigneExtraEdits((s) => ({
                                ...s,
                                [l.id]: {
                                  ...s[l.id],
                                  date_livraison: e.target.value,
                                  technicien_id: s[l.id]?.technicien_id ?? null,
                                  notes_ligne: s[l.id]?.notes_ligne ?? '',
                                },
                              }))
                            }
                          />
                        </label>
                        <label className="form-group bc-fiche__ligne-notes">
                          Notes ligne
                          <input
                            type="text"
                            value={ligneExtraEdits[l.id]?.notes_ligne ?? ''}
                            placeholder="Commentaire interne…"
                            onChange={(e) =>
                              setLigneExtraEdits((s) => ({
                                ...s,
                                [l.id]: {
                                  ...s[l.id],
                                  notes_ligne: e.target.value,
                                  technicien_id: s[l.id]?.technicien_id ?? null,
                                  date_livraison: s[l.id]?.date_livraison ?? '',
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
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
    </ModuleEntityShell>
  )
}
