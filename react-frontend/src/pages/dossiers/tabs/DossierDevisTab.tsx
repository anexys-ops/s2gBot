import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'

export default function DossierDevisTab() {
  const { id } = useParams<{ id: string }>()
  const dossierId = Number(id)
  const { dossier } = useOutletContext<DossierFicheOutletContext>()

  const { data: devis, isLoading, error } = useQuery({
    queryKey: ['dossier-devis', dossierId],
    queryFn: () => dossiersApi.devis(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  })

  if (isLoading) {
    return <p className="text-muted">Chargement des devis…</p>
  }
  if (error) {
    return <p className="error">{(error as Error).message}</p>
  }

  return (
    <div>
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Devis rattachés au dossier <code>{dossier.reference}</code> (liaison <code>dossier_id</code> sur le devis).
      </p>
      {!devis?.length && <p className="text-muted">Aucun devis lié pour l’instant.</p>}
      {!!devis?.length && (
        <div className="table-wrap">
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
              {devis.map((q) => (
                <tr key={q.id}>
                  <td>
                    <code>{q.number}</code>
                  </td>
                  <td>{q.status}</td>
                  <td>{q.quote_date ? String(q.quote_date).slice(0, 10) : '—'}</td>
                  <td>{q.amount_ttc}</td>
                  <td>
                    <Link to={`/devis/${q.id}/editer`} className="link-inline">
                      Ouvrir
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
