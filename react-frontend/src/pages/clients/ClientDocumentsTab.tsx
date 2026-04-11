import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attachmentsApi } from '../../api/client'
import type { ClientOutletContext } from './ClientLayout'
import { useOutletContext } from 'react-router-dom'

export default function ClientDocumentsTab() {
  const { clientId, isLab } = useOutletContext<ClientOutletContext>()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-attachments', clientId],
    queryFn: () => attachmentsApi.list('client', clientId),
    enabled: clientId > 0,
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(file, 'client', clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-attachments', clientId] })
      queryClient.invalidateQueries({ queryKey: ['client-commercial', clientId] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => attachmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-attachments', clientId] })
      queryClient.invalidateQueries({ queryKey: ['client-commercial', clientId] })
    },
  })

  if (isLoading) return <p>Chargement…</p>
  if (error) return <p className="error">{(error as Error).message}</p>

  const list = Array.isArray(data) ? data : []

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Documents & pièces jointes</h2>
      <p style={{ marginTop: 0, fontSize: '0.9rem', color: '#64748b' }}>
        Fichiers rattachés au tiers (contrats, Kbis, plans…). Même logique que les pièces jointes Dolibarr sur une fiche
        société.
      </p>
      {isLab && (
        <div className="form-group" style={{ maxWidth: 420 }}>
          <label>Ajouter un document</label>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadMut.mutate(f)
              e.target.value = ''
            }}
          />
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Fichier</th>
            <th>Taille</th>
            {isLab && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((att) => (
            <tr key={att.id}>
              <td>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => attachmentsApi.download(att.id, att.original_filename)}
                >
                  {att.original_filename}
                </button>
                {att.mime_type ? (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>{att.mime_type}</span>
                ) : null}
              </td>
              <td>{Math.round(att.size_bytes / 1024)} Ko</td>
              {isLab && (
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-danger-outline"
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${att.original_filename} » ?`)) deleteMut.mutate(att.id)
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && <p style={{ padding: '0.5rem 0' }}>Aucun document.</p>}
    </div>
  )
}
