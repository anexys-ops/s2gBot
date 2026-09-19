import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsLivraisonApi, type BonLivraison } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import StatusBadge, { bonLivraisonStatutBadgeProps } from '../../components/ds/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast, { type ToastVariant } from '../../components/Toast'
import { formatAppDate } from '../../lib/appLocale'

export default function PortalBonsLivraisonPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [blToSign, setBlToSign] = useState<BonLivraison | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  const { data: bls = [], isLoading, isError } = useQuery({
    queryKey: ['portal-bons-livraison', user?.client_id],
    queryFn: () =>
      bonsLivraisonApi.list({ client_id: user?.client_id ?? undefined }),
    staleTime: 30_000,
    enabled: !!user,
  })

  const mutAccuser = useMutation({
    mutationFn: (bl: BonLivraison) => bonsLivraisonApi.accuserReception(bl.id),
    onSuccess: (updated) => {
      setBlToSign(null)
      setToast({ message: `Réception accusée pour le BL ${updated.numero}.`, variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['portal-bons-livraison'] })
      void qc.invalidateQueries({ queryKey: ['bon-livraison', updated.id] })
    },
    onError: (err) => {
      setToast({ message: (err as Error).message ?? 'Erreur lors de l\'accusé de réception.', variant: 'error' })
    },
  })

  const sorted = [...bls].sort((a, b) => {
    const order = (s: string) => (s === 'livre' ? 0 : s === 'signe' ? 1 : 2)
    return order(a.statut) - order(b.statut) || new Date(b.date_livraison).getTime() - new Date(a.date_livraison).getTime()
  })

  return (
    <ModuleEntityShell
      breadcrumbs={[{ label: 'Portail', to: '/portal' }, { label: 'Bons de livraison' }]}
      moduleBarLabel="Portail client — Bons de livraison"
      title="Mes bons de livraison"
      subtitle="Accusez réception des livraisons et consultez les rapports associés."
    >
      {isLoading && <p className="text-muted">Chargement…</p>}
      {isError && <p className="error">Impossible de charger les bons de livraison.</p>}

      {!isLoading && !isError && sorted.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucun bon de livraison disponible pour le moment.</p>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>N° BL</th>
                  <th>Dossier / Chantier</th>
                  <th>Date livraison</th>
                  <th>Statut</th>
                  <th>Rapports</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((bl) => {
                  const badge = bonLivraisonStatutBadgeProps(bl.statut)
                  return (
                    <tr key={bl.id}>
                      <td><code>{bl.numero}</code></td>
                      <td>
                        {bl.dossier ? (
                          <span>
                            <strong>{bl.dossier.reference}</strong>
                            {bl.dossier.titre ? ` — ${bl.dossier.titre}` : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{formatAppDate(bl.date_livraison)}</td>
                      <td><StatusBadge variant={badge.variant} size="sm">{badge.label}</StatusBadge></td>
                      <td>
                        {bl.statut === 'signe' ? (
                          <Link to={`/portal/bons-livraison/${bl.id}`} className="link-inline">
                            Voir les rapports →
                          </Link>
                        ) : (
                          <span className="text-muted">Disponibles après réception</span>
                        )}
                      </td>
                      <td>
                        <div className="crud-actions">
                          <Link to={`/portal/bons-livraison/${bl.id}`} className="btn btn-secondary btn-sm">
                            Détail
                          </Link>
                          {bl.statut === 'livre' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => setBlToSign(bl)}
                            >
                              Accuser réception
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {blToSign && (
        <ConfirmDialog
          title="Accuser réception du bon de livraison"
          message={
            <div>
              <p>
                Vous vous apprêtez à confirmer la réception du bon{' '}
                <strong>{blToSign.numero}</strong> daté du{' '}
                <strong>{formatAppDate(blToSign.date_livraison)}</strong>.
              </p>
              <p style={{ marginTop: '0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>
                En validant, vous confirmez avoir reçu les articles et/ou documents listés
                dans ce bon de livraison. Cette action est irréversible.
              </p>
              {(blToSign.dossier) && (
                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                  Dossier : {blToSign.dossier.reference}
                  {blToSign.dossier.titre ? ` — ${blToSign.dossier.titre}` : ''}
                </p>
              )}
            </div>
          }
          confirmLabel="Confirmer la réception"
          loading={mutAccuser.isPending}
          error={mutAccuser.isError ? (mutAccuser.error as Error).message : null}
          onConfirm={() => mutAccuser.mutate(blToSign)}
          onCancel={() => { if (!mutAccuser.isPending) setBlToSign(null) }}
        />
      )}

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      )}
    </ModuleEntityShell>
  )
}
