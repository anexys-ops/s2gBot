import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, devisV1Api, quotesApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function BonsCommandeListPage() {
  const qc = useQueryClient()
  const [statut, setStatut] = useState<string>('')
  const [quoteId, setQuoteId] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['bons-commande', statut || 'all'],
    queryFn: () => bonsCommandeApi.list(statut ? { statut } : undefined),
  })
  const { data: signedQuotes } = useQuery({
    queryKey: ['quotes', 'bc-source', 'signed'],
    queryFn: () => quotesApi.list({ status: 'signed' }),
  })
  const { data: acceptedQuotes } = useQuery({
    queryKey: ['quotes', 'bc-source', 'accepted'],
    queryFn: () => quotesApi.list({ status: 'accepted' }),
  })
  const quoteOptions = [...(signedQuotes?.data ?? []), ...(acceptedQuotes?.data ?? [])].filter((q, index, arr) => (
    q.dossier_id && arr.findIndex((x) => x.id === q.id) === index
  ))
  const createMut = useMutation({
    mutationFn: () => devisV1Api.transformerBc(Number(quoteId)),
    onSuccess: (bc) => {
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      setQuoteId('')
      if (bc?.id) window.location.assign(`/bons-commande/${bc.id}`)
    },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => bonsCommandeApi.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bons-commande'] }),
  })

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Commercial', to: '/crm' },
        { label: 'Bons de commande' },
      ]}
      moduleBarLabel="Commercial"
      title="Bons de commande"
    >
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Nomenclature BCC — transformation depuis un devis signé / accepté (côté lab).
      </p>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 className="h2" style={{ fontSize: '1.05rem' }}>Créer depuis un devis</h2>
        <div className="crud-actions">
          <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} style={{ minWidth: 320 }}>
            <option value="">Choisir un devis signé / accepté avec dossier…</option>
            {quoteOptions.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.number} — {quote.client?.name ?? `Client #${quote.client_id}`} — dossier #{quote.dossier_id}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={!quoteId || createMut.isPending} onClick={() => createMut.mutate()}>
            Créer le BC
          </button>
        </div>
        {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
      </div>
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
                    <div className="crud-actions">
                      <Link to={`/bons-commande/${bc.id}`} className="link-inline">
                        Ouvrir
                      </Link>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer le bon de commande ${bc.numero} ?`)) deleteMut.mutate(bc.id)
                        }}
                      >
                        Supprimer
                      </button>
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
