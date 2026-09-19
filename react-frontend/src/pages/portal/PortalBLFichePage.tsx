import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsLivraisonApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import StatusBadge, { bonLivraisonStatutBadgeProps } from '../../components/ds/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast, { type ToastVariant } from '../../components/Toast'
import { formatAppDate, formatQuantity } from '../../lib/appLocale'

const RAPPORT_STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  preliminaire: 'Préliminaire',
  valide: 'Validé',
  archive: 'Archivé',
}

export default function PortalBLFichePage() {
  const { id } = useParams<{ id: string }>()
  const blId = Number(id)
  const qc = useQueryClient()
  const [confirmReception, setConfirmReception] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  const { data: bl, isLoading, error } = useQuery({
    queryKey: ['bon-livraison', blId],
    queryFn: () => bonsLivraisonApi.get(blId),
    enabled: Number.isFinite(blId) && blId > 0,
  })

  const mutAccuser = useMutation({
    mutationFn: () => bonsLivraisonApi.accuserReception(blId),
    onSuccess: (updated) => {
      setConfirmReception(false)
      setToast({ message: `Réception accusée — BL ${updated.numero} signé.`, variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['bon-livraison', blId] })
      void qc.invalidateQueries({ queryKey: ['portal-bons-livraison'] })
    },
    onError: (err) => {
      setToast({ message: (err as Error).message ?? 'Erreur lors de l\'accusé de réception.', variant: 'error' })
    },
  })

  const badge = bl ? bonLivraisonStatutBadgeProps(bl.statut) : null
  const rapports = bl?.rapport_bcs ?? []

  if (!Number.isFinite(blId) || blId <= 0) {
    return <p className="error">Identifiant invalide.</p>
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[{ label: 'Portail', to: '/portal' }, { label: 'Bons de livraison', to: '/portal/bons-livraison' }, { label: '…' }]}
        moduleBarLabel="Portail client — Bon de livraison"
        title="Chargement…"
      >
        <p className="text-muted">Chargement…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !bl) {
    return (
      <ModuleEntityShell
        breadcrumbs={[{ label: 'Portail', to: '/portal' }, { label: 'Bons de livraison', to: '/portal/bons-livraison' }, { label: 'Erreur' }]}
        moduleBarLabel="Portail client — Bon de livraison"
        title="Introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Accès refusé.'}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Portail', to: '/portal' },
        { label: 'Bons de livraison', to: '/portal/bons-livraison' },
        { label: bl.numero },
      ]}
      moduleBarLabel="Portail client — Bon de livraison"
      title={`Bon de livraison ${bl.numero}`}
      subtitle={
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {badge && <StatusBadge variant={badge.variant} size="sm">{badge.label}</StatusBadge>}
          {bl.dossier && <span>{bl.dossier.reference}{bl.dossier.titre ? ` — ${bl.dossier.titre}` : ''}</span>}
        </span>
      }
      actions={
        bl.statut === 'livre' ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setConfirmReception(true)}
          >
            Accuser réception
          </button>
        ) : null
      }
    >
      <div className="bc-fiche">
        {/* Résumé */}
        <section className="card bc-fiche__summary" aria-label="Informations du bon de livraison">
          <div className="bc-fiche__summary-grid">
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Date livraison</span>
              <span className="bc-fiche__summary-value">{formatAppDate(bl.date_livraison)}</span>
            </div>
            <div className="bc-fiche__summary-item">
              <span className="bc-fiche__summary-label">Statut</span>
              <span className="bc-fiche__summary-value">
                {badge && <StatusBadge variant={badge.variant} size="sm">{badge.label}</StatusBadge>}
              </span>
            </div>
            {bl.clientContact && (
              <div className="bc-fiche__summary-item">
                <span className="bc-fiche__summary-label">Contact livraison</span>
                <span className="bc-fiche__summary-value">{bl.clientContact.prenom} {bl.clientContact.nom}</span>
              </div>
            )}
          </div>
          {bl.statut === 'signe' && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#d1fae5', borderRadius: 6, color: '#065f46', fontSize: '0.88rem', fontWeight: 600 }}>
              ✓ Réception confirmée — merci pour votre accusé de réception.
            </div>
          )}
        </section>

        <div className="bc-fiche__layout">
          {/* Articles */}
          <div className="bc-fiche__main">
            <section className="card dossier-tab-panel dossier-tab-panel--table">
              <div className="dossier-tab-panel__header">
                <h2 className="ds-form-section__title">Articles livrés</h2>
              </div>
              {!bl.lignes?.length ? (
                <p className="dossier-tab-empty">Aucun article sur ce bon de livraison.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table data-table--compact">
                    <thead>
                      <tr>
                        <th>Libellé</th>
                        <th className="data-table__num">Quantité livrée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bl.lignes.map((l) => (
                        <tr key={l.id}>
                          <td>{l.libelle}</td>
                          <td className="data-table__num">{formatQuantity(l.quantite_livree)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Rapports liés */}
            <section className="card dossier-tab-panel">
              <div className="dossier-tab-panel__header">
                <h2 className="ds-form-section__title">Rapports inclus dans ce BL</h2>
              </div>
              {rapports.length === 0 ? (
                <p className="dossier-tab-empty text-muted" style={{ padding: '1rem 1.5rem' }}>
                  Aucun rapport associé à ce bon de livraison.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table data-table--compact">
                    <thead>
                      <tr>
                        <th>N° Rapport</th>
                        <th>Titre</th>
                        <th>Statut</th>
                        <th>Notes</th>
                        {bl.statut === 'signe' && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rapports.map((r) => (
                        <tr key={r.id}>
                          <td><code>{r.numero}</code></td>
                          <td>{r.titre ?? '—'}</td>
                          <td>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                              {RAPPORT_STATUT_LABELS[r.statut] ?? r.statut}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{r.notes ?? '—'}</td>
                          {bl.statut === 'signe' && (
                            <td>
                              {r.latest_version ? (
                                <a
                                  href={`/api/rapport-bc/${r.id}/versions/${r.latest_version.id}/download`}
                                  className="btn btn-secondary btn-sm"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Télécharger PDF
                                </a>
                              ) : (
                                <span className="text-muted" style={{ fontSize: '0.82rem' }}>Pas de version</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="bc-fiche__aside">
            <section className="card bc-fiche__aside-panel">
              <h2 className="ds-form-section__title">Dossier</h2>
              {bl.dossier ? (
                <div>
                  <p style={{ fontWeight: 600 }}>{bl.dossier.reference}</p>
                  {bl.dossier.titre && <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>{bl.dossier.titre}</p>}
                  <Link to={`/portal/dossiers/${bl.dossier_id}`} className="link-inline" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                    Voir le dossier →
                  </Link>
                </div>
              ) : (
                <p className="text-muted">—</p>
              )}
            </section>
          </aside>
        </div>
      </div>

      {confirmReception && (
        <ConfirmDialog
          title="Accuser réception du bon de livraison"
          message={
            <div>
              <p>
                Vous confirmez avoir reçu le bon <strong>{bl.numero}</strong> daté du{' '}
                <strong>{formatAppDate(bl.date_livraison)}</strong>.
              </p>
              <p style={{ marginTop: '0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>
                Cette confirmation est définitive et rendra les rapports associés téléchargeables.
              </p>
            </div>
          }
          confirmLabel="Confirmer la réception"
          loading={mutAccuser.isPending}
          error={mutAccuser.isError ? (mutAccuser.error as Error).message : null}
          onConfirm={() => mutAccuser.mutate()}
          onCancel={() => { if (!mutAccuser.isPending) setConfirmReception(false) }}
        />
      )}

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      )}
    </ModuleEntityShell>
  )
}
