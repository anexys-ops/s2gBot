import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { nonConformitiesApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const NC_STATUS = [
  { value: 'open', label: 'Ouverte' },
  { value: 'analyzing', label: 'Analyse' },
  { value: 'action', label: 'Action' },
  { value: 'closed', label: 'Clôturée' },
]

const CA_STATUS = [
  { value: 'pending', label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Faite' },
  { value: 'verified', label: 'Vérifiée' },
]

export default function NonConformityDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ncId = id ? parseInt(id, 10) : 0
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [actionTitle, setActionTitle] = useState('')

  const { data: nc, isLoading, error } = useQuery({
    queryKey: ['non-conformities', ncId],
    queryFn: () => nonConformitiesApi.get(ncId),
    enabled: isLab && ncId > 0,
  })

  const updateNc = useMutation({
    mutationFn: (body: { status: string }) => nonConformitiesApi.update(ncId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformities', ncId] })
      queryClient.invalidateQueries({ queryKey: ['non-conformities'] })
      queryClient.invalidateQueries({ queryKey: ['non-conformities-stats'] })
    },
  })

  const addAction = useMutation({
    mutationFn: () =>
      nonConformitiesApi.createAction(ncId, {
        title: actionTitle.trim(),
        status: 'pending',
        responsible_user_id: user?.id ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformities', ncId] })
      setActionTitle('')
    },
  })

  const updateAction = useMutation({
    mutationFn: ({ id: aid, status }: { id: number; status: string }) =>
      nonConformitiesApi.updateAction(aid, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['non-conformities', ncId] }),
  })

  const deleteNc = useMutation({
    mutationFn: () => nonConformitiesApi.delete(ncId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformities'] })
      navigate('/back-office/non-conformites')
    },
  })

  if (!isLab) {
    return <Navigate to="/" replace />
  }

  if (!ncId || Number.isNaN(ncId)) {
    return <Navigate to="/back-office/non-conformites" replace />
  }

  if (isLoading) {
    return <p className="design-card__muted">Chargement…</p>
  }
  if (error || !nc) {
    return <p className="design-card__error">{(error as Error)?.message ?? 'Introuvable'}</p>
  }

  return (
    <div className="design-card">
      <div style={{ marginBottom: 12 }}>
        <Link to="/back-office/non-conformites">← Liste NC</Link>
      </div>
      <h2 className="design-card__title" style={{ marginBottom: 8 }}>
        {nc.reference}
      </h2>
      <p className="design-card__muted" style={{ marginBottom: 16 }}>
        Détectée le {new Date(nc.detected_at).toLocaleString('fr-FR')} — gravité {nc.severity}
      </p>

      <div style={{ marginBottom: 16 }}>
        <label className="design-card__muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Statut
          <select
            className="input"
            value={nc.status}
            onChange={(e) => updateNc.mutate({ status: e.target.value })}
            disabled={updateNc.isPending}
          >
            {NC_STATUS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && (
          <button
            type="button"
            className="btn"
            style={{ marginLeft: 12 }}
            onClick={() => {
              if (window.confirm('Supprimer cette non-conformité ?')) deleteNc.mutate()
            }}
          >
            Supprimer
          </button>
        )}
      </div>

      <section style={{ marginBottom: 24 }}>
        <h3>Description</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{nc.description}</p>
      </section>

      <section>
        <h3>Actions correctives</h3>
        <ul>
          {(nc.corrective_actions ?? []).map((a) => (
            <li key={a.id} style={{ marginBottom: 8 }}>
              <strong>{a.title}</strong> — {a.status}
              <select
                className="input"
                style={{ marginLeft: 8 }}
                value={a.status}
                onChange={(e) => updateAction.mutate({ id: a.id, status: e.target.value })}
                disabled={updateAction.isPending}
              >
                {CA_STATUS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Intitulé d’une nouvelle action"
            value={actionTitle}
            onChange={(e) => setActionTitle(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!actionTitle.trim() || addAction.isPending}
            onClick={() => addAction.mutate()}
          >
            Ajouter
          </button>
        </div>
      </section>
    </div>
  )
}
