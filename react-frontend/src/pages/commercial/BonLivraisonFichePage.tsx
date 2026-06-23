import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsLivraisonApi } from '../../api/client'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast, { toastErrorMessage, type ToastVariant } from '../../components/Toast'
import StatusBadge, { bonLivraisonStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ClientContactPicker, { formatClientContactLabel } from '../../components/clients/ClientContactPicker'
import { dateInputFromApi, formatAppDate, formatQuantity } from '../../lib/appLocale'
import { buildBcLigneDisplayRows } from '../../lib/bcLigneDisplay'

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

function qtyNum(value: string | number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const BL_STATUT_OPTIONS = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'livre', label: 'Livré' },
  { value: 'signe', label: 'Signé' },
] as const

export default function BonLivraisonFichePage() {
  const { id } = useParams<{ id: string }>()
  const blId = Number(id)
  const { user } = useAuth()
  const qc = useQueryClient()
  const lab = isLab(user?.role)

  const [notes, setNotes] = useState('')
  const [contactId, setContactId] = useState<number | null>(null)
  const [dateLivraison, setDateLivraison] = useState('')
  const [ligneQty, setLigneQty] = useState<Record<number, string>>({})
  const [confirmValider, setConfirmValider] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  const { data: bl, isLoading, error } = useQuery({
    queryKey: ['bon-livraison', blId],
    queryFn: () => bonsLivraisonApi.get(blId),
    enabled: Number.isFinite(blId) && blId > 0,
  })

  useEffect(() => {
    if (!bl) return
    setNotes(typeof bl.notes === 'string' ? bl.notes : '')
    setContactId(bl.contact_id ?? null)
    setDateLivraison(dateInputFromApi(bl.date_livraison))
  }, [bl?.id])

  const serverLignesKey = useMemo(
    () =>
      (bl?.lignes ?? [])
        .map((l) => `${l.id}:${l.quantite_livree}:${l.quantite_restante}:${l.libelle}`)
        .join('|'),
    [bl?.lignes],
  )

  useEffect(() => {
    if (!bl?.lignes?.length) {
      setLigneQty({})
      return
    }
    const next: Record<number, string> = {}
    for (const l of bl.lignes) {
      next[l.id] = String(l.quantite_livree)
    }
    setLigneQty(next)
  }, [bl?.id, serverLignesKey])

  const canEdit = lab && bl?.statut === 'brouillon'
  const statutBadge = useMemo(
    () => (bl ? bonLivraisonStatutBadgeProps(bl.statut) : null),
    [bl?.statut],
  )

  const totalQtyLivree = useMemo(() => {
    if (!bl?.lignes?.length) return 0
    return bl.lignes.reduce((sum, l) => {
      const raw = ligneQty[l.id]
      const n = raw === undefined || raw === '' ? qtyNum(l.quantite_livree) : Number(raw)
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
  }, [bl?.lignes, ligneQty])

  const ligneOverLimit = useMemo(() => {
    const over: Record<number, boolean> = {}
    for (const l of bl?.lignes ?? []) {
      const raw = ligneQty[l.id]
      const n = raw === undefined || raw === '' ? qtyNum(l.quantite_livree) : Number(raw)
      const max = qtyNum(l.quantite_restante)
      over[l.id] = Number.isFinite(n) && n > max + 1e-9
    }
    return over
  }, [bl?.lignes, ligneQty])

  const hasOverLimit = useMemo(() => Object.values(ligneOverLimit).some(Boolean), [ligneOverLimit])

  const ligneDisplayRows = useMemo(
    () => buildBcLigneDisplayRows(bl?.lignes ?? [], bl?.bonCommande?.quote?.meta),
    [bl?.lignes, bl?.bonCommande?.quote?.meta],
  )

  const mutSaveLignes = useMutation({
    mutationFn: (qty: Record<number, string>) => {
      const lignes = (bl?.lignes ?? [])
        .map((l) => {
          const raw = qty[l.id]
          const n = raw === undefined || raw === '' ? Number(l.quantite_livree) : Number(raw)
          return { id: l.id, quantite_livree: Number.isFinite(n) ? n : 0 }
        })
        .filter((r) => r.id > 0)
      return bonsLivraisonApi.update(blId, { lignes })
    },
    onSuccess: () => {
      setToast({ message: 'Quantités livrées enregistrées.', variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['bon-livraison', blId] })
      void qc.invalidateQueries({ queryKey: ['bons-livraison'] })
    },
    onError: (err) => {
      setToast({
        message: toastErrorMessage(err, 'Échec de l’enregistrement des quantités.'),
        variant: 'error',
      })
    },
  })

  const mutSaveInfos = useMutation({
    mutationFn: () =>
      bonsLivraisonApi.update(blId, {
        notes: notes || undefined,
        contact_id: contactId,
        date_livraison: dateLivraison || undefined,
      }),
    onSuccess: () => {
      setToast({ message: 'Informations du BL enregistrées.', variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['bon-livraison', blId] })
      void qc.invalidateQueries({ queryKey: ['bons-livraison'] })
    },
    onError: (err) => {
      setToast({
        message: toastErrorMessage(err, 'Échec de l’enregistrement des informations.'),
        variant: 'error',
      })
    },
  })

  const mutValider = useMutation({
    mutationFn: () => bonsLivraisonApi.valider(blId),
    onSuccess: () => {
      setConfirmValider(false)
      setToast({ message: 'Bon de livraison validé.', variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['bon-livraison', blId] })
      void qc.invalidateQueries({ queryKey: ['bons-livraison'] })
    },
    onError: (err) => {
      setToast({
        message: toastErrorMessage(err, 'Échec de la validation du BL.'),
        variant: 'error',
      })
    },
  })

  const mutStatut = useMutation({
    mutationFn: (statut: string) => bonsLivraisonApi.update(blId, { statut }),
    onSuccess: () => {
      setToast({ message: 'Statut du BL mis à jour.', variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['bon-livraison', blId] })
      void qc.invalidateQueries({ queryKey: ['bons-livraison'] })
    },
    onError: (err) => {
      setToast({
        message: toastErrorMessage(err, 'Échec de la mise à jour du statut.'),
        variant: 'error',
      })
    },
  })

  const shellProps = {
    shellClassName: 'module-shell--crm' as const,
    moduleBarLabel: 'Commercial — Bon de livraison',
  }

  if (!Number.isFinite(blId) || blId <= 0) {
    return <p className="error">Identifiant invalide.</p>
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        {...shellProps}
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de livraison', to: '/bons-livraison' },
          { label: '…' },
        ]}
        title="Chargement…"
      >
        <p className="text-muted">Chargement du bon de livraison…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !bl) {
    return (
      <ModuleEntityShell
        {...shellProps}
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de livraison', to: '/bons-livraison' },
          { label: 'Erreur' },
        ]}
        title="Introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Accès refusé.'}</p>
      </ModuleEntityShell>
    )
  }

  const ligneCount = bl.lignes?.length ?? 0

  return (
    <ModuleEntityShell
      {...shellProps}
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Bons de livraison', to: '/bons-livraison' },
        { label: bl.numero },
      ]}
      title={`Bon de livraison ${bl.numero}`}
      subtitle={
        <span className="bc-fiche__subtitle">
          {statutBadge ? (
            <StatusBadge variant={statutBadge.variant} size="sm">
              {statutBadge.label}
            </StatusBadge>
          ) : null}
          {bl.client?.name ? (
            <Link to={`/clients/${bl.client_id}`} className="link-inline">
              {bl.client.name}
            </Link>
          ) : null}
          {bl.dossier ? (
            <Link to={`/dossiers/${bl.dossier_id}/bc-bl`} className="link-inline">
              {bl.dossier.reference} — {bl.dossier.titre}
            </Link>
          ) : (
            <Link to={`/dossiers/${bl.dossier_id}/bc-bl`} className="link-inline">
              Dossier #{bl.dossier_id}
            </Link>
          )}
        </span>
      }
      actions={
        lab && canEdit ? (
          <div className="bc-fiche__header-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setConfirmValider(true)}
              disabled={mutValider.isPending}
            >
              Valider le BL
            </button>
          </div>
        ) : null
      }
    >
      <div className="bc-fiche">
        <section className="card bc-fiche__summary" aria-label="Synthèse du bon de livraison">
          <div className="bc-fiche__summary-grid">
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Date livraison</span>
              <span className="bc-fiche__summary-value">{formatAppDate(bl.date_livraison)}</span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">BC source</span>
              <span className="bc-fiche__summary-value">
                {bl.bon_commande_id ? (
                  <Link to={`/bons-commande/${bl.bon_commande_id}`} className="link-inline">
                    {bl.bonCommande?.numero ?? `#${bl.bon_commande_id}`}
                  </Link>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Contact livraison</span>
              <span className="bc-fiche__summary-value">
                {bl.clientContact ? formatClientContactLabel(bl.clientContact) : '—'}
              </span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Lignes</span>
              <span className="bc-fiche__summary-value">{ligneCount}</span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Qté totale livrée</span>
              <span className="bc-fiche__summary-value bc-fiche__summary-value--amount">
                {formatQuantity(totalQtyLivree)}
              </span>
            </div>
          </div>
        </section>

        <div className="bc-fiche__layout">
          <div className="bc-fiche__main">
            <section className="card dossier-tab-panel dossier-tab-panel--table">
              <div className="dossier-tab-panel__header">
                <h2 className="ds-form-section__title">Lignes livrées</h2>
                <p className="dossier-tab-panel__intro">
                  {canEdit
                    ? 'Quantités du bon de commande, déjà livrées sur d’autres BL (Livré / Signé), reste à livrer et saisie pour ce BL.'
                    : 'Articles et prestations repris du bon de commande — quantités effectivement livrées.'}
                </p>
              </div>

              {canEdit && (bl.autres_bons_livraison?.length ?? 0) > 0 ? (
                <div className="bl-delivery-context">
                  <p>
                    Autres bons de livraison sur ce BC — seuls les statuts <strong>Livré</strong> et{' '}
                    <strong>Signé</strong> sont pris en compte dans la colonne « Déjà livrée ».
                  </p>
                  <ul className="bl-delivery-context__list">
                    {bl.autres_bons_livraison!.map((other) => {
                      const st = bonLivraisonStatutBadgeProps(other.statut)
                      return (
                        <li key={other.id}>
                          <Link to={`/bons-livraison/${other.id}`} className="link-inline">
                            {other.numero}
                          </Link>
                          {' — '}
                          <StatusBadge variant={st.variant} size="sm">
                            {st.label}
                          </StatusBadge>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}

              {ligneCount === 0 ? (
                <p className="dossier-tab-empty">Aucune ligne sur ce bon de livraison.</p>
              ) : (
                <>
                  {canEdit ? (
                    <div className="bc-fiche__planning-header" style={{ padding: '0 1.5rem 0.75rem' }}>
                      <div />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setToast(null)
                          mutSaveLignes.mutate(ligneQty)
                        }}
                        disabled={mutSaveLignes.isPending || hasOverLimit}
                        title={hasOverLimit ? 'Corrigez les quantités qui dépassent le reste à livrer.' : undefined}
                      >
                        {mutSaveLignes.isPending ? 'Enregistrement…' : 'Enregistrer les quantités'}
                      </button>
                    </div>
                  ) : null}

                  {mutSaveLignes.isPending ? (
                    <p className="bc-fiche__planning-status text-muted" style={{ padding: '0 1.5rem' }} role="status">
                      Enregistrement des quantités en cours…
                    </p>
                  ) : null}
                  {mutSaveLignes.isSuccess && !mutSaveLignes.isPending ? (
                    <p
                      className="bc-fiche__planning-status bc-fiche__planning-status--success"
                      style={{ padding: '0 1.5rem' }}
                      role="status"
                    >
                      Quantités enregistrées avec succès.
                    </p>
                  ) : null}
                  {mutSaveLignes.isError ? (
                    <p className="error" style={{ padding: '0 1.5rem 0.75rem' }}>
                      {(mutSaveLignes.error as Error).message}
                    </p>
                  ) : null}

                  <div className="table-wrap">
                    <table className="data-table data-table--compact bc-lignes-table bc-lignes-table--delivery">
                      <colgroup>
                        <col className="bc-lignes-table__col-libelle" />
                        <col className="bc-lignes-table__col-qty" />
                        <col className="bc-lignes-table__col-qty" />
                        <col className="bc-lignes-table__col-qty" />
                        <col className="bc-lignes-table__col-qty" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th scope="col">Libellé</th>
                          <th scope="col" className="data-table__num">
                            Qté BC
                          </th>
                          <th scope="col" className="data-table__num">
                            Déjà livrée
                          </th>
                          <th scope="col" className="data-table__num">
                            Reste
                          </th>
                          <th scope="col" className="data-table__num">
                            Qté livrée
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ligneDisplayRows.map((row) => {
                          if (row.type === 'jalon_header') {
                            return (
                              <tr key={row.key} className="bc-lignes-table__jalon">
                                <td colSpan={5}>
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
                          const reste = qtyNum(l.quantite_restante)
                          const over = ligneOverLimit[l.id]
                          return (
                            <tr
                              key={row.key}
                              className={row.nested ? 'bc-lignes-table__product--nested' : undefined}
                            >
                              <td>{l.libelle}</td>
                              <td className="data-table__num">{formatQuantity(l.quantite_commandee ?? 0)}</td>
                              <td className="data-table__num">{formatQuantity(l.quantite_deja_livree ?? 0)}</td>
                              <td className="data-table__num">{formatQuantity(reste)}</td>
                              <td className="data-table__num">
                                {canEdit ? (
                                  <div>
                                    <input
                                      type="number"
                                      min={0}
                                      max={reste}
                                      step={1}
                                      className="bc-fiche__qty-input"
                                      value={ligneQty[l.id] ?? String(l.quantite_livree)}
                                      aria-invalid={over || undefined}
                                      onChange={(e) => {
                                        mutSaveLignes.reset()
                                        setLigneQty((m) => ({ ...m, [l.id]: e.target.value }))
                                      }}
                                    />
                                    {over ? (
                                      <div className="bl-ligne-qty-over" role="alert">
                                        Max. {formatQuantity(reste)}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  formatQuantity(l.quantite_livree)
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} className="data-table__foot-label">
                            Total livré (ce BL)
                          </td>
                          <td className="data-table__num data-table__foot-value">
                            {formatQuantity(totalQtyLivree)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>

          <aside className="bc-fiche__aside">
            {lab ? (
              <section className="card bc-fiche__aside-panel entity-statut-panel">
                <h2 className="ds-form-section__title">Statut du bon</h2>
                <div className="entity-statut-panel__current">
                  {statutBadge ? (
                    <StatusBadge variant={statutBadge.variant} size="sm">
                      {statutBadge.label}
                    </StatusBadge>
                  ) : null}
                  {mutStatut.isPending ? (
                    <span className="text-muted entity-statut-panel__pending">Mise à jour…</span>
                  ) : null}
                </div>
                <p className="entity-statut-panel__hint text-muted">
                  {canEdit
                    ? 'Brouillon : le BL reste modifiable. Validez ou passez à Livré / Signé.'
                    : 'Repassez en Brouillon pour modifier les quantités et les informations.'}
                </p>
                <div className="entity-statut-panel__options" role="group" aria-label="Changer le statut">
                  {BL_STATUT_OPTIONS.map((opt) => {
                    const active = bl.statut === opt.value
                    const st = bonLivraisonStatutBadgeProps(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`entity-statut-panel__option${active ? ' entity-statut-panel__option--active' : ''}`}
                        disabled={mutStatut.isPending || active}
                        aria-pressed={active}
                        onClick={() => mutStatut.mutate(opt.value)}
                      >
                        <span
                          className={`entity-statut-panel__dot entity-statut-panel__dot--${st.variant}`}
                          aria-hidden
                        />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {lab ? (
              <section className="card bc-fiche__aside-panel">
                <h2 className="ds-form-section__title">Contact &amp; date</h2>
                <ClientContactPicker
                  clientId={bl.client_id}
                  value={contactId}
                  onChange={(cid) => setContactId(cid)}
                  label="Contact livraison"
                  contactType="livraison"
                />
                <label className="form-group" style={{ marginTop: '0.75rem' }}>
                  Date de livraison
                  <input
                    type="date"
                    value={dateLivraison}
                    disabled={!canEdit}
                    onChange={(e) => setDateLivraison(e.target.value)}
                  />
                </label>
                {canEdit ? (
                  <div className="bc-fiche__aside-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setToast(null)
                        mutSaveInfos.mutate()
                      }}
                      disabled={mutSaveInfos.isPending}
                    >
                      {mutSaveInfos.isPending ? 'Enregistrement…' : 'Enregistrer contact & date'}
                    </button>
                  </div>
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
                    disabled={!canEdit}
                    placeholder="Consignes de livraison, remarques…"
                  />
                </label>
                {canEdit ? (
                  <div className="bc-fiche__aside-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setToast(null)
                        mutSaveInfos.mutate()
                      }}
                      disabled={mutSaveInfos.isPending}
                    >
                      {mutSaveInfos.isPending ? 'Enregistrement…' : 'Enregistrer les notes'}
                    </button>
                  </div>
                ) : null}
                {mutSaveInfos.isError ? (
                  <p className="error">{(mutSaveInfos.error as Error).message}</p>
                ) : null}
              </section>
            ) : null}

            {lab ? (
              <ExtrafieldsForm
                entityType="bon_livraison"
                entityId={bl.id}
                canEdit={canEdit}
                title="Champs personnalisés"
              />
            ) : null}
          </aside>
        </div>
      </div>

      {confirmValider ? (
        <ConfirmDialog
          title="Valider le bon de livraison"
          message={
            <>
              Valider le bon <strong>{bl.numero}</strong> ? Le statut passera à{' '}
              <strong>Livré</strong> et le document ne sera plus modifiable.
            </>
          }
          confirmLabel="Valider le BL"
          loading={mutValider.isPending}
          error={mutValider.isError ? (mutValider.error as Error).message : null}
          onConfirm={() => mutValider.mutate()}
          onCancel={() => {
            if (!mutValider.isPending) setConfirmValider(false)
          }}
        />
      ) : null}

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </ModuleEntityShell>
  )
}
