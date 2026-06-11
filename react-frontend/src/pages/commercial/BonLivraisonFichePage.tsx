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
import { dateInputFromApi, formatAppDate } from '../../lib/appLocale'

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

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
        .map((l) => `${l.id}:${l.quantite_livree}:${l.libelle}`)
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
      const n = raw === undefined || raw === '' ? Number(l.quantite_livree) : Number(raw)
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
  }, [bl?.lignes, ligneQty])

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
        lab ? (
          <div className="bc-fiche__header-actions">
            <label className="bc-fiche__statut-select">
              <span className="bc-fiche__statut-select-label">Statut</span>
              <select
                value={bl.statut}
                disabled={mutStatut.isPending}
                onChange={(e) => mutStatut.mutate(e.target.value)}
              >
                {BL_STATUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setConfirmValider(true)}
                disabled={mutValider.isPending}
              >
                Valider le BL
              </button>
            ) : null}
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
                {totalQtyLivree}
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
                  Articles et prestations repris du bon de commande — quantités effectivement livrées.
                </p>
              </div>

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
                        disabled={mutSaveLignes.isPending}
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
                    <table className="data-table data-table--compact">
                      <thead>
                        <tr>
                          <th>Libellé</th>
                          <th className="data-table__num">Qté livrée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bl.lignes!.map((l) => (
                          <tr key={l.id}>
                            <td>{l.libelle}</td>
                            <td className="data-table__num">
                              {canEdit ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="bc-fiche__qty-input"
                                  value={ligneQty[l.id] ?? String(l.quantite_livree)}
                                  onChange={(e) => {
                                    mutSaveLignes.reset()
                                    setLigneQty((m) => ({ ...m, [l.id]: e.target.value }))
                                  }}
                                />
                              ) : (
                                l.quantite_livree
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="data-table__foot-label">Total livré</td>
                          <td className="data-table__num data-table__foot-value">{totalQtyLivree}</td>
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

            {!canEdit && lab ? (
              <section className="card bc-fiche__aside-panel">
                <p className="text-muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                  Statut <strong>{statutBadge?.label ?? bl.statut}</strong> — édition verrouillée. Repassez en{' '}
                  <strong>Brouillon</strong> via le sélecteur de statut en haut pour modifier à nouveau.
                </p>
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
