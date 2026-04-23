import { useQuery } from '@tanstack/react-query'
import { comptaV1Api } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function ComptaFondationPage() {
  const { data: regs, isLoading: lr } = useQuery({
    queryKey: ['compta-reglements'],
    queryFn: () => comptaV1Api.reglements.list(),
  })
  const { data: sit, isLoading: ls } = useQuery({
    queryKey: ['compta-situations'],
    queryFn: () => comptaV1Api.situations.list(),
  })
  const { data: av, isLoading: la } = useQuery({
    queryKey: ['compta-avoirs'],
    queryFn: () => comptaV1Api.avoirs.list(),
  })

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'CRM', to: '/crm' },
        { label: 'Compta (fondation)' },
      ]}
      moduleBarLabel="Comptabilité"
      title="Règlements, situations et avoirs"
    >
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Tables d’appui BDC-139 : suivi en lecture seule (création via API / outils internes pour l’instant).
      </p>

      <h2 className="h2" style={{ fontSize: '1.1rem' }}>
        Règlements
      </h2>
      {lr && <p className="text-muted">Chargement…</p>}
      {!lr && !regs?.length && <p className="text-muted" style={{ marginBottom: '1.25rem' }}>Aucun règlement.</p>}
      {!!regs?.length && (
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Facture</th>
                <th>Mode</th>
                <th>Date</th>
                <th>Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.numero}</code>
                  </td>
                  <td>#{r.client_id}</td>
                  <td>{r.invoice_id ?? '—'}</td>
                  <td>{r.payment_mode}</td>
                  <td>{String(r.payment_date).slice(0, 10)}</td>
                  <td>{r.amount_ttc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="h2" style={{ fontSize: '1.1rem' }}>
        Situations de travaux
      </h2>
      {ls && <p className="text-muted">Chargement…</p>}
      {!ls && !sit?.length && <p className="text-muted" style={{ marginBottom: '1.25rem' }}>Aucune situation.</p>}
      {!!sit?.length && (
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Dossier</th>
                <th>Libellé</th>
                <th>%</th>
                <th>HT</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {sit.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code>{s.numero}</code>
                  </td>
                  <td>#{s.dossier_id}</td>
                  <td>{s.label}</td>
                  <td>{s.percent_complete}</td>
                  <td>{s.amount_ht}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="h2" style={{ fontSize: '1.1rem' }}>
        Avoirs (credits)
      </h2>
      {la && <p className="text-muted">Chargement…</p>}
      {!la && !av?.length && <p className="text-muted">Aucun avoir.</p>}
      {!!av?.length && (
        <div className="table-wrap">
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Facture source</th>
                <th>TTC</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {av.map((a) => (
                <tr key={a.id}>
                  <td>
                    <code>{a.numero}</code>
                  </td>
                  <td>#{a.client_id}</td>
                  <td>#{a.source_invoice_id}</td>
                  <td>{a.amount_ttc}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModuleEntityShell>
  )
}
