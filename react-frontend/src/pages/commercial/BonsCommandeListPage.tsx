import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { bonsCommandeApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function BonsCommandeListPage() {
  const [statut, setStatut] = useState<string>('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['bons-commande', statut || 'all'],
    queryFn: () => bonsCommandeApi.list(statut ? { statut } : undefined),
  })

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'CRM', to: '/crm' },
        { label: 'Bons de commande' },
      ]}
      moduleBarLabel="Commercial"
      title="Bons de commande"
    >
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Nomenclature BCC — transformation depuis un devis signé / accepté (côté lab).
      </p>
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
        <label>
          Filtre statut
          <select value={statut} onChange={(e) => setStatut(e.target.value)} style={{ marginLeft: '0.35rem' }}>
            <option value="">Tous</option>
            <option value="brouillon">Brouillon</option>
            <option value="confirme">Confirmé</option>
            <option value="en_cours">En cours</option>
            <option value="livre">Livré</option>
            <option value="annule">Annulé</option>
          </select>
        </label>
      </div>
      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {!isLoading && !data?.length && <p className="text-muted">Aucun bon de commande.</p>}
      {!!data?.length && (
        <div className="table-wrap">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Dossier</th>
                <th>Statut</th>
                <th>Date</th>
                <th>HT / TTC</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((bc) => (
                <tr key={bc.id}>
                  <td>
                    <code>{bc.numero}</code>
                  </td>
                  <td>
                    {bc.dossier ? (
                      <Link to={`/dossiers/${bc.dossier_id}/bc-bl`} className="link-inline">
                        {bc.dossier.reference ?? `#${bc.dossier_id}`}
                      </Link>
                    ) : (
                      `#${bc.dossier_id}`
                    )}
                  </td>
                  <td>{bc.statut}</td>
                  <td>{String(bc.date_commande).slice(0, 10)}</td>
                  <td>
                    {bc.montant_ht} / {bc.montant_ttc}
                  </td>
                  <td>
                    <Link to={`/bons-commande/${bc.id}`} className="link-inline">
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
