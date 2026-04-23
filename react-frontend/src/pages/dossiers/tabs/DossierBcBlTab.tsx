import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'

export default function DossierBcBlTab() {
  const { id } = useParams<{ id: string }>()
  const dossierId = Number(id)
  const { dossier } = useOutletContext<DossierFicheOutletContext>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dossier-bons', dossierId],
    queryFn: () => dossiersApi.bons(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  })

  if (isLoading) {
    return <p className="text-muted">Chargement des bons de commande et bons de livraison…</p>
  }
  if (error) {
    return <p className="error">{(error as Error).message}</p>
  }

  const bcs = data?.bons_commande ?? []
  const bls = data?.bons_livraison ?? []

  return (
    <div>
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Bons rattachés au dossier <code>{dossier.reference}</code>. Voir aussi la{' '}
        <Link to="/bons-commande" className="link-inline">
          liste globale des bons de commande
        </Link>
        .
      </p>

      <h2 className="h2" style={{ fontSize: '1.05rem', marginTop: '0.5rem' }}>
        Bons de commande
      </h2>
      {!bcs.length && <p className="text-muted">Aucun bon de commande pour ce dossier.</p>}
      {!!bcs.length && (
        <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Montant TTC</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bcs.map((bc) => (
                <tr key={bc.id}>
                  <td>
                    <code>{bc.numero}</code>
                  </td>
                  <td>{bc.statut}</td>
                  <td>{String(bc.date_commande).slice(0, 10)}</td>
                  <td>{bc.montant_ttc}</td>
                  <td>
                    <Link to={`/bons-commande/${bc.id}`} className="link-inline">
                      Fiche
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="h2" style={{ fontSize: '1.05rem' }}>
        Bons de livraison
      </h2>
      {!bls.length && <p className="text-muted">Aucun bon de livraison pour ce dossier.</p>}
      {!!bls.length && (
        <div className="table-wrap">
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Statut</th>
                <th>Date</th>
                <th>BC lié</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bls.map((bl) => (
                <tr key={bl.id}>
                  <td>
                    <code>{bl.numero}</code>
                  </td>
                  <td>{bl.statut}</td>
                  <td>{String(bl.date_livraison).slice(0, 10)}</td>
                  <td>
                    {bl.bon_commande_id ? (
                      <Link to={`/bons-commande/${bl.bon_commande_id}`} className="link-inline">
                        #{bl.bon_commande_id}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Link to={`/bons-livraison/${bl.id}`} className="link-inline">
                      Fiche
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
