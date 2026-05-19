import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { labReportsApi, type LabReport } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { formatAppDate } from '../../lib/appLocale'

const STATUS_META: Record<
  LabReport['status'],
  { label: string; color: string; bg: string }
> = {
  brouillon:     { label: 'Brouillon',     color: '#6b7280', bg: '#f3f4f6' },
  en_validation: { label: 'En validation', color: '#f59e0b', bg: '#fef3c7' },
  valide:        { label: 'Validé',        color: '#3b82f6', bg: '#dbeafe' },
  signe:         { label: 'Signé',         color: '#8b5cf6', bg: '#ede9fe' },
  emis:          { label: 'Émis',          color: '#10b981', bg: '#d1fae5' },
}

function StatusBadge({ status }: { status: LabReport['status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.brouillon
  return (
    <span
      style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 10,
        color: meta.color,
        background: meta.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  )
}

export default function LabReportsListPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: paginator, isLoading } = useQuery({
    queryKey: ['lab-reports', statusFilter],
    queryFn: () => labReportsApi.list(statusFilter ? { status: statusFilter } : undefined),
    staleTime: 30_000,
  })

  const reports = paginator?.data ?? []

  const createMut = useMutation({
    mutationFn: () =>
      labReportsApi.create({ title: 'Nouveau rapport d\'essais' }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['lab-reports'] })
      navigate(`/labo/rapports/${created.id}`)
    },
  })

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Laboratoire', to: '/labo' },
        { label: 'Rapports d\'essais' },
      ]}
      moduleBarLabel="Laboratoire — Rapports"
      title="Rapports d'essais"
      subtitle={`${reports.length} rapport${reports.length !== 1 ? 's' : ''}`}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">— Tous statuts —</option>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? 'Création…' : '+ Nouveau rapport'}
          </button>
        </div>
      }
    >
      {isLoading && <p className="text-muted">Chargement…</p>}

      {!isLoading && reports.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Aucun rapport d'essais.</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            disabled={createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            + Créer le premier rapport
          </button>
        </div>
      )}

      {reports.length > 0 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={th}>Numéro</th>
                <th style={th}>Titre</th>
                <th style={th}>Statut</th>
                <th style={th}>Technicien</th>
                <th style={th}>Date création</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={td}>
                    <Link
                      to={`/labo/rapports/${r.id}`}
                      style={{ fontWeight: 700, color: '#1e40af' }}
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td style={td}>{r.title}</td>
                  <td style={td}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td style={td}>{r.technician?.name ?? '—'}</td>
                  <td style={td}>{formatAppDate(r.created_at)}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Link
                        to={`/labo/rapports/${r.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Voir
                      </Link>
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

const th: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  color: '#374151',
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const td: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  verticalAlign: 'middle',
}
