import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { labReportsApi } from '../../api/client'
import LabReportView from '../../components/labo/rapports/LabReportView'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function LabReportViewPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const id = reportId ? Number(reportId) : 0

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['lab-report', id],
    queryFn: () => labReportsApi.get(id),
    enabled: id > 0,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Laboratoire', to: '/labo' },
          { label: 'Rapports', to: '/labo/rapports' },
          { label: 'Chargement…' },
        ]}
        moduleBarLabel="Laboratoire — Rapport"
        title="Rapport d'essais"
      >
        <p className="text-muted">Chargement du rapport…</p>
      </ModuleEntityShell>
    )
  }

  if (isError || !report) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Laboratoire', to: '/labo' },
          { label: 'Rapports', to: '/labo/rapports' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Laboratoire — Rapport"
        title="Rapport introuvable"
      >
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Rapport #{id} introuvable ou erreur de chargement.</p>
          <Link to="/labo/rapports" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Retour à la liste
          </Link>
        </div>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Laboratoire', to: '/labo' },
        { label: 'Rapports', to: '/labo/rapports' },
        { label: report.number },
      ]}
      moduleBarLabel="Laboratoire — Rapport"
      title={report.title}
      subtitle={report.number}
      actions={
        <Link to="/labo/rapports" className="btn btn-secondary btn-sm">
          ← Retour à la liste
        </Link>
      }
    >
      <LabReportView report={report} />
    </ModuleEntityShell>
  )
}
