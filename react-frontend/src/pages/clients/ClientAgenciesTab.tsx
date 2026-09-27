import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agencesApi, clientsApi, type Agency } from '../../api/client'

type Props = {
  clientId: number
  canEdit: boolean
}

export default function ClientAgenciesTab({ clientId, canEdit }: Props) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<number[]>([])
  const [dirty, setDirty] = useState(false)

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
  })

  const { data: agences = [], isLoading: agencesLoading } = useQuery({
    queryKey: ['agences'],
    queryFn: () => agencesApi.list(),
  })

  const labAgences = agences.filter((a) => a.active !== false)

  useEffect(() => {
    const ids = (client?.visible_lab_agencies ?? []).map((a) => a.id)
    setSelected(ids)
    setDirty(false)
  }, [client])

  const saveMut = useMutation({
    mutationFn: () => clientsApi.syncLabAgencies(clientId, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      setDirty(false)
    },
  })

  const toggle = (id: number) => {
    setDirty(true)
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (clientLoading || agencesLoading) {
    return <p className="text-muted">Chargement…</p>
  }

  return (
    <div className="card">
      <h3 className="ds-form-section__title" style={{ marginTop: 0 }}>
        Agences autorisées
      </h3>
      <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
        Cochez les agences labo qui peuvent voir ce client. Laissez vide pour le rendre visible à{' '}
        <strong>toutes</strong> les agences (comportement par défaut). Le siège voit toujours l’ensemble.
      </p>

      {labAgences.length === 0 ? (
        <p className="text-muted">Aucune agence configurée. Créez-les dans Configuration → Agences.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflow: 'auto' }}>
          {labAgences.map((a: Agency) => (
            <label key={a.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={selected.includes(a.id)}
                disabled={!canEdit}
                onChange={() => toggle(a.id)}
              />
              <span>
                {a.name}
                {a.code ? ` (${a.code})` : ''}
                {a.is_siege ? ' — siège' : ''}
              </span>
            </label>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!dirty || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            Enregistrer
          </button>
          {saveMut.isError && <p className="error">{(saveMut.error as Error).message}</p>}
        </div>
      )}
    </div>
  )
}
