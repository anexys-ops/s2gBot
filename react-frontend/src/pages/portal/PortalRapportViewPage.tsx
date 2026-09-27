import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { labReportsApi } from '../../api/client'
import LabReportView from '../../components/labo/rapports/LabReportView'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function PortalRapportViewPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const id = reportId ? Number(reportId) : 0

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['portal-lab-report', id],
    queryFn: () => labReportsApi.get(id),
    enabled: id > 0,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Portail', to: '/portal' },
          { label: 'Rapports', to: '/portal/rapports' },
          { label: 'Chargement…' },
        ]}
        moduleBarLabel="Portail client — Rapport"
        title="Rapport d'essais"
      >
        <p className="text-muted">Chargement…</p>
      </ModuleEntityShell>
    )
  }

  if (isError || !report) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Portail', to: '/portal' },
          { label: 'Rapports', to: '/portal/rapports' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Portail client — Rapport"
        title="Rapport introuvable"
      >
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Rapport indisponible ou accès refusé.</p>
          <Link to="/portal/rapports" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Retour à la liste
          </Link>
        </div>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Portail', to: '/portal' },
        { label: 'Rapports', to: '/portal/rapports' },
        { label: report.number },
      ]}
      moduleBarLabel="Portail client — Rapport"
      title={report.title}
      subtitle={report.number}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            Imprimer / PDF
          </button>
          <Link to="/portal/rapports" className="btn btn-secondary btn-sm">
            ← Retour
          </Link>
        </div>
      }
    >
      <div className="portal-report-print">
        <LabReportView report={report} />
      </div>
    </ModuleEntityShell>
  )
}
