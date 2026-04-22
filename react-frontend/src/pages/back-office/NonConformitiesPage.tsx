import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { nonConformitiesApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'

const SEVERITY_OPTS = [
  { value: '', label: 'Toutes gravités' },
  { value: 'minor', label: 'Mineure' },
  { value: 'major', label: 'Majeure' },
  { value: 'critical', label: 'Critique' },
]

const STATUS_OPTS = [
  { value: '', label: 'Tous statuts' },
  { value: 'open', label: 'Ouverte' },
  { value: 'analyzing', label: 'Analyse' },
  { value: 'action', label: 'Action' },
  { value: 'closed', label: 'Clôturée' },
]

export default function NonConformitiesPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    description: '',
    severity: 'minor' as string,
    status: 'open' as string,
  })

  const listParams = useMemo(() => {
    const p: { status?: string; severity?: string } = {}
    if (status) p.status = status
    if (severity) p.severity = severity
    return p
  }, [status, severity])

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['non-conformities', listParams],
    queryFn: () => nonConformitiesApi.list(listParams),
    enabled: isLab,
  })

  const { data: stats } = useQuery({
    queryKey: ['non-conformities-stats'],
    queryFn: () => nonConformitiesApi.stats(),
    enabled: isLab,
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('Utilisateur manquant')
      return nonConformitiesApi.create({
        detected_at: new Date().toISOString(),
        detected_by: user.id,
        sample_id: null,
        equipment_id: null,
        order_id: null,
        severity: form.severity,
        description: form.description.trim(),
        status: form.status,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformities'] })
      queryClient.invalidateQueries({ queryKey: ['non-conformities-stats'] })
      setCreateOpen(false)
      setForm({ description: '', severity: 'minor', status: 'open' })
    },
  })

  if (!isLab) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="design-card">
      {stats && (
        <div
          className="design-card__toolbar"
          style={{ marginBottom: 16, gap: 16, flexWrap: 'wrap' }}
        >
          <span>
            <strong>NC ouvertes</strong> : {stats.open}
          </span>
          <span>
            <strong>Clôturées</strong> : {stats.closed}
          </span>
          {stats.avg_resolution_days != null && (
            <span>
              <strong>Délai moyen (j.)</strong> : {stats.avg_resolution_days}
            </span>
          )}
        </div>
      )}

      <div className="design-card__toolbar" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <label className="design-card__muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUS_OPTS.map((o) => (
              <option key={o.value || 'all-s'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="design-card__muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Gravité
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input">
            {SEVERITY_OPTS.map((o) => (
              <option key={o.value || 'all-sev'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
          Nouvelle non-conformité
        </button>
      </div>

      {isLoading && <p className="design-card__muted">Chargement…</p>}
      {error && <p className="design-card__error">{(error as Error).message}</p>}

      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Réf.</th>
            <th>Date</th>
            <th>Gravité</th>
            <th>Statut</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link to={`/back-office/non-conformites/${r.id}`}>{r.reference}</Link>
              </td>
              <td>{r.detected_at ? new Date(r.detected_at).toLocaleString('fr-FR') : '—'}</td>
              <td>{r.severity}</td>
              <td>{r.status}</td>
              <td style={{ maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && !isLoading && <p className="design-card__muted">Aucune non-conformité.</p>}

      {createOpen && (
        <Modal onClose={() => setCreateOpen(false)} title="Nouvelle non-conformité (CAPA)">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
        >
          <label className="design-card__muted" style={{ display: 'block', marginBottom: 8 }}>
            Gravité
            <select
              className="input"
              style={{ width: '100%' }}
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            >
              <option value="minor">mineure</option>
              <option value="major">majeure</option>
              <option value="critical">critique</option>
            </select>
          </label>
          <label className="design-card__muted" style={{ display: 'block', marginBottom: 8 }}>
            Statut initial
            <select
              className="input"
              style={{ width: '100%' }}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="open">ouverte</option>
              <option value="analyzing">analyse</option>
              <option value="action">action</option>
            </select>
          </label>
          <label className="design-card__muted" style={{ display: 'block', marginBottom: 8 }}>
            Description
            <textarea
              className="input"
              required
              rows={4}
              style={{ width: '100%' }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          {createMutation.isError && (
            <p className="design-card__error">{(createMutation.error as Error).message}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
              Enregistrer
            </button>
            <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
              Annuler
            </button>
          </div>
        </form>
        </Modal>
      )}
    </div>
  )
}
