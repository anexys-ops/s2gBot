import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, planningTerrainApi, type BonCommandeLigne } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast, { toastErrorMessage, type ToastVariant } from '../../components/Toast'
import StatusBadge, { bonCommandeStatutBadgeProps, bonLivraisonStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ClientContactPicker from '../../components/clients/ClientContactPicker'
import { buildBcLigneDisplayRows } from '../../lib/bcLigneDisplay'
import { dateInputFromApi, formatAppDate, formatMoney, formatQuantity, MONEY_UNIT_LABEL } from '../../lib/appLocale'

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
  const [planningToast, setPlanningToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

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

  const serverLignesKey = useMemo(
    () =>
      (bc?.lignes ?? [])
        .map((l) =>
          [
            l.id,
            dateInputFromApi(l.date_debut_prevue),
            dateInputFromApi(l.date_fin_prevue),
            l.technicien_id ?? '',
            dateInputFromApi(l.date_livraison),
            l.notes_ligne ?? '',
          ].join(':'),
        )
        .join('|'),
    [bc?.lignes],
  )

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

  const mutLignes = useMutation({
    mutationFn: async (payload: {
      edits: Record<number, LignePeriodeEdit>
      extras: Record<number, LigneExtraEdit>
    }) => {
      if (!bc?.lignes?.length) return
      for (const l of bc.lignes) {
        const periode = payload.edits[l.id] ?? { debut: '', fin: '' }
        const extra = payload.extras[l.id] ?? {
          technicien_id: null,
          date_livraison: '',
          notes_ligne: '',
        }
        await bonsCommandeApi.updateLigne(bcId, l.id, {
          date_debut_prevue: periode.debut || null,
          date_fin_prevue: periode.fin || null,
          technicien_id: extra.technicien_id,
          date_livraison: extra.date_livraison || null,
          notes_ligne: extra.notes_ligne || null,
        })
      }
    },
    onSuccess: () => {
      setPlanningToast({ message: 'Planification enregistrée.', variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
      void qc.invalidateQueries({ queryKey: ['planning-terrain'] })
      void qc.invalidateQueries({ queryKey: ['planning-overview'] })
    },
    onError: (err) => {
      setPlanningToast({
        message: toastErrorMessage(err, 'Échec de l’enregistrement de la planification.'),
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

  const ligneCount = bc?.lignes?.length ?? 0
  const ligneDisplayRows = useMemo(
    () => buildBcLigneDisplayRows(bc?.lignes ?? [], bc?.quote?.meta),
    [bc?.lignes, bc?.quote?.meta],
  )
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
                  <table className="data-table data-table--compact bc-lignes-table">
                    <colgroup>
                      <col className="bc-lignes-table__col-libelle" />
                      <col className="bc-lignes-table__col-qty" />
                      <col className="bc-lignes-table__col-money" />
                      <col className="bc-lignes-table__col-money" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Libellé</th>
                        <th scope="col" className="data-table__num">
                          Qté
                        </th>
                        <th scope="col" className="data-table__num">
                          PU HT ({MONEY_UNIT_LABEL})
                        </th>
                        <th scope="col" className="data-table__num">
                          Montant HT ({MONEY_UNIT_LABEL})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ligneDisplayRows.map((row) => {
                        if (row.type === 'jalon_header') {
                          return (
                            <tr key={row.key} className="bc-lignes-table__jalon">
                              <td colSpan={4}>
                                {row.code ? (
                                  <>
                                    <span className="bc-lignes-table__jalon-code">{row.code}</span>
                                    {' — '}
                                  </>
                                ) : null}
                                {row.label}
                              </td>
                            </tr>
                          )
                        }
                        const l = row.ligne
                        return (
                          <tr
                            key={row.key}
                            className={row.nested ? 'bc-lignes-table__product--nested' : undefined}
                          >
                            <td>{l.libelle}</td>
                            <td className="data-table__num">{formatQuantity(l.quantite)}</td>
                            <td className="data-table__num">{formatMoney(Number(l.prix_unitaire_ht))}</td>
                            <td className="data-table__num">{formatMoney(Number(l.montant_ht))}</td>
                          </tr>
                        )
                      })}
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
                    onClick={() => {
                      setPlanningToast(null)
                      mutLignes.mutate({ edits: ligneEdits, extras: ligneExtraEdits })
                    }}
                    disabled={mutLignes.isPending}
                  >
                    {mutLignes.isPending ? 'Enregistrement…' : 'Enregistrer la planification'}
                  </button>
                </div>

                {mutLignes.isPending ? (
                  <p className="bc-fiche__planning-status text-muted" role="status">
                    Enregistrement de la planification en cours…
                  </p>
                ) : null}
                {mutLignes.isSuccess && !mutLignes.isPending ? (
                  <p className="bc-fiche__planning-status bc-fiche__planning-status--success" role="status">
                    Planification enregistrée avec succès.
                  </p>
                ) : null}
                {mutLignes.isError ? (
                  <p className="error bc-fiche__planning-error">{(mutLignes.error as Error).message}</p>
                ) : null}

                <div className="bc-fiche__ligne-cards">
                  {bc.lignes!.map((l) => (
                    <article key={l.id} className="bc-fiche__ligne-card">
                      <header className="bc-fiche__ligne-card-header">
                        <h3 className="bc-fiche__ligne-card-title">{l.libelle}</h3>
                        <span className="bc-fiche__ligne-card-meta text-muted">
                          Qté {formatQuantity(l.quantite)} — {formatMoney(Number(l.montant_ht))} HT
                        </span>
                      </header>
                      <div className="bc-fiche__ligne-card-grid">
                        <label className="form-group">
                          Début terrain (prévu)
                          <input
                            type="date"
                            value={ligneEdits[l.id]?.debut ?? ''}
                            onChange={(e) => {
                              mutLignes.reset()
                              setLigneEdits((s) => ({
                                ...s,
                                [l.id]: { debut: e.target.value, fin: s[l.id]?.fin ?? '' },
                              }))
                            }}
                          />
                        </label>
                        <label className="form-group">
                          Fin terrain (prévu)
                          <input
                            type="date"
                            value={ligneEdits[l.id]?.fin ?? ''}
                            onChange={(e) => {
                              mutLignes.reset()
                              setLigneEdits((s) => ({
                                ...s,
                                [l.id]: { debut: s[l.id]?.debut ?? '', fin: e.target.value },
                              }))
                            }}
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
