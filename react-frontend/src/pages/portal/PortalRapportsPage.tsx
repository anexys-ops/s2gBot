import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { labReportsApi, type LabReport } from '../../api/client'
import { formatAppDate } from '../../lib/appLocale'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const STATUS_LABELS: Record<LabReport['status'], string> = {
  brouillon: 'Brouillon',
  en_validation: 'En validation',
  valide: 'Validé',
  signe: 'Signé',
  emis: 'Émis / livré',
}

export default function PortalRapportsPage() {
  const { data: paginator, isLoading, isError } = useQuery({
    queryKey: ['portal-rapports'],
    queryFn: () => labReportsApi.list(),
    staleTime: 30_000,
  })

  const reports = paginator?.data ?? []

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Portail', to: '/portal' },
        { label: 'Rapports livrés' },
      ]}
      moduleBarLabel="Portail client — Rapports"
      title="Rapports d'essais livrés"
      subtitle="Rapports signés ou émis, prêts à consulter et télécharger."
    >
      {isLoading && <p className="text-muted">Chargement…</p>}
      {isError && <p className="error">Impossible de charger les rapports.</p>}

      {!isLoading && !isError && reports.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucun rapport livré disponible pour le moment.</p>
        </div>
      )}

      {!isLoading && reports.length > 0 && (
        <div className="table-responsive card">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>N° rapport</th>
                <th>Titre</th>
                <th>Dossier</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.number}</code></td>
                  <td>{r.title}</td>
                  <td>{r.dossier?.reference ?? (r.dossier_id ? `#${r.dossier_id}` : '—')}</td>
                  <td>{STATUS_LABELS[r.status] ?? r.status}</td>
                  <td>{r.emitted_at ? formatAppDate(r.emitted_at) : r.signed_at ? formatAppDate(r.signed_at) : '—'}</td>
                  <td>
                    <Link to={`/portal/rapports/${r.id}`} className="btn btn-secondary btn-sm">
                      Consulter
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
