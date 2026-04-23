import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { bonsLivraisonApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function BonsLivraisonListPage() {
  const [statut, setStatut] = useState<string>('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['bons-livraison', statut || 'all'],
    queryFn: () => bonsLivraisonApi.list(statut ? { statut } : undefined),
  })

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Commercial', to: '/crm' },
        { label: 'Bons de livraison' },
      ]}
      moduleBarLabel="Commercial"
      title="Bons de livraison"
    >
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Nomenclature BLC — issus d’un bon de commande confirmé.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Filtre statut
          <select value={statut} onChange={(e) => setStatut(e.target.value)} style={{ marginLeft: '0.35rem' }}>
            <option value="">Tous</option>
            <option value="brouillon">Brouillon</option>
            <option value="livre">Livré</option>
            <option value="signe">Signé</option>
          </select>
        </label>
      </div>
      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {!isLoading && !data?.length && <p className="text-muted">Aucun bon de livraison.</p>}
      {!!data?.length && (
        <div className="table-wrap">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Dossier</th>
                <th>BC</th>
                <th>Statut</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((bl) => (
                <tr key={bl.id}>
                  <td>
                    <code>{bl.numero}</code>
                  </td>
                  <td>
                    {bl.dossier ? (
                      <Link to={`/dossiers/${bl.dossier_id}/bc-bl`} className="link-inline">
                        {bl.dossier.reference ?? `#${bl.dossier_id}`}
                      </Link>
                    ) : (
                      `#${bl.dossier_id}`
                    )}
                  </td>
                  <td>
                    {bl.bon_commande_id ? (
                      <Link to={`/bons-commande/${bl.bon_commande_id}`} className="link-inline">
                        #{bl.bon_commande_id}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{bl.statut}</td>
                  <td>{String(bl.date_livraison).slice(0, 10)}</td>
                  <td>
                    <Link to={`/bons-livraison/${bl.id}`} className="link-inline">
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModuleEntityShell>
  )
}
