import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { attachmentsApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import { useAuth } from '../../../contexts/AuthContext'
import ConfirmDialog from '../../../components/ConfirmDialog'

export default function DossierDocumentsTab() {
  const { dossier, dossierId } = useOutletContext<DossierFicheOutletContext>()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const qc = useQueryClient()
  const [toDelete, setToDelete] = useState<{ id: number; name: string } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['attachments', 'dossier', dossierId],
    queryFn: () => attachmentsApi.list('dossier', dossierId),
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(file, 'dossier', dossierId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attachments', 'dossier', dossierId] })
      void qc.invalidateQueries({ queryKey: ['dossier', dossierId] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => attachmentsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attachments', 'dossier', dossierId] })
      void qc.invalidateQueries({ queryKey: ['dossier', dossierId] })
      setToDelete(null)
    },
  })

  if (isLoading) {
    return (
      <div className="dossier-tab">
        <p className="text-muted">Chargement des documents…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="dossier-tab">
        <p className="error">{(error as Error).message}</p>
      </div>
    )
  }

  const list = Array.isArray(data) ? data : []

  return (
    <div className="dossier-tab">
      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <div className="dossier-tab-panel__header">
          <h2 className="ds-form-section__title">Documents du dossier</h2>
          <p className="dossier-tab-panel__intro">
            Fichiers rattachés au dossier <code>{dossier.reference}</code> (contrats, plans, rapports…).
          </p>
          {isLab && (
            <div className="form-group" style={{ maxWidth: 420, marginBottom: 0 }}>
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
        </div>
        {list.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>Taille</th>
                  {isLab && <th className="data-table__actions">Actions</th>}
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
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                          {att.mime_type}
                        </span>
                      ) : null}
                    </td>
                    <td>{Math.round(att.size_bytes / 1024)} Ko</td>
                    {isLab && (
                      <td className="data-table__actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => setToDelete({ id: att.id, name: att.original_filename })}
                        >
                          Supprimer
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dossier-tab-empty">Aucun document pour ce dossier.</p>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Supprimer le document"
          message={
            <>
              Supprimer définitivement <strong>« {toDelete.name} »</strong> ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(toDelete.id)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
