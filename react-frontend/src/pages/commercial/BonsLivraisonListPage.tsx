import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, bonsLivraisonApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function BonsLivraisonListPage() {
  const qc = useQueryClient()
  const [statut, setStatut] = useState<string>('')
  const [bcId, setBcId] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['bons-livraison', statut || 'all'],
    queryFn: () => bonsLivraisonApi.list(statut ? { statut } : undefined),
  })
  const { data: confirmedBc = [] } = useQuery({
    queryKey: ['bons-commande', 'bl-source', 'confirme'],
    queryFn: () => bonsCommandeApi.list({ statut: 'confirme' }),
  })
  const createMut = useMutation({
    mutationFn: () => bonsCommandeApi.transformerBl(Number(bcId)),
    onSuccess: (bl) => {
      void qc.invalidateQueries({ queryKey: ['bons-livraison'] })
      setBcId('')
      if (bl?.id) window.location.assign(`/bons-livraison/${bl.id}`)
    },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => bonsLivraisonApi.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bons-livraison'] }),
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
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 className="h2" style={{ fontSize: '1.05rem' }}>Créer depuis un bon de commande</h2>
        <div className="crud-actions">
          <select value={bcId} onChange={(e) => setBcId(e.target.value)} style={{ minWidth: 320 }}>
            <option value="">Choisir un BC confirmé…</option>
            {confirmedBc.map((bc) => (
              <option key={bc.id} value={bc.id}>
                {bc.numero} — {bc.client?.name ?? `Client #${bc.client_id}`} — dossier #{bc.dossier_id}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={!bcId || createMut.isPending} onClick={() => createMut.mutate()}>
            Créer le BL
          </button>
        </div>
        {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
      </div>
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
                    <div className="crud-actions">
                      <Link to={`/bons-livraison/${bl.id}`} className="link-inline">
                        Ouvrir
                      </Link>
                      {bl.statut === 'brouillon' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm(`Supprimer le bon de livraison ${bl.numero} ?`)) deleteMut.mutate(bl.id)
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
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
