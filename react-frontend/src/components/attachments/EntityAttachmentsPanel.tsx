import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attachmentsApi } from '../../api/client'
import { formatAppDateTime } from '../../lib/appLocale'
import ConfirmDialog from '../ConfirmDialog'

export type AttachableType =
  | 'client'
  | 'quote'
  | 'invoice'
  | 'order'
  | 'site'
  | 'equipment'
  | 'calibration'
  | 'dossier'
  | 'bon_commande'

interface EntityAttachmentsPanelProps {
  attachableType: AttachableType
  attachableId: number
  canUpload?: boolean
  canDelete?: boolean
  title?: string
  intro?: string
  className?: string
}

export default function EntityAttachmentsPanel({
  attachableType,
  attachableId,
  canUpload = false,
  canDelete = false,
  title = 'Pièces jointes',
  intro,
  className = 'card bc-fiche__aside-panel',
}: EntityAttachmentsPanelProps) {
  const qc = useQueryClient()
  const [toDelete, setToDelete] = useState<{ id: number; name: string } | null>(null)
  const queryKey = ['attachments', attachableType, attachableId] as const

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => attachmentsApi.list(attachableType, attachableId),
    enabled: attachableId > 0,
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(file, attachableType, attachableId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => attachmentsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey })
      setToDelete(null)
    },
  })

  const list = Array.isArray(data) ? data : []

  return (
    <section className={className}>
      <h2 className="ds-form-section__title">{title}</h2>
      {intro ? <p className="text-muted entity-attachments-panel__intro">{intro}</p> : null}

      {canUpload ? (
        <div className="form-group entity-attachments-panel__upload">
          <label htmlFor={`attachment-upload-${attachableType}-${attachableId}`}>Ajouter un fichier</label>
          <input
            id={`attachment-upload-${attachableType}-${attachableId}`}
            type="file"
            disabled={uploadMut.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadMut.mutate(f)
              e.target.value = ''
            }}
          />
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-muted">Chargement…</p>
      ) : error ? (
        <p className="error">{(error as Error).message}</p>
      ) : list.length > 0 ? (
        <ul className="entity-attachments-panel__list">
          {list.map((att) => (
            <li key={att.id} className="entity-attachments-panel__item">
              <button
                type="button"
                className="btn-link entity-attachments-panel__filename"
                onClick={() => attachmentsApi.download(att.id, att.original_filename)}
              >
                {att.original_filename}
              </button>
              {att.created_at ? (
                <span className="text-muted entity-attachments-panel__date" title="Date d'ajout">
                  {formatAppDateTime(att.created_at)}
                </span>
              ) : null}
              <span className="text-muted entity-attachments-panel__size">
                {Math.round(att.size_bytes / 1024)} Ko
              </span>
              {canDelete ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm btn-danger-outline"
                  onClick={() => setToDelete({ id: att.id, name: att.original_filename })}
                >
                  Supprimer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted entity-attachments-panel__empty">Aucune pièce jointe.</p>
      )}

      {uploadMut.isError ? <p className="error">{(uploadMut.error as Error).message}</p> : null}

      {toDelete ? (
        <ConfirmDialog
          title="Supprimer la pièce jointe"
          message={
            <>
              Supprimer définitivement <strong>« {toDelete.name} »</strong> ?
            </>
          }
          confirmLabel="Supprimer"
          variant="danger"
          loading={deleteMut.isPending}
          error={deleteMut.isError ? (deleteMut.error as Error).message : null}
          onConfirm={() => deleteMut.mutate(toDelete.id)}
          onCancel={() => {
            if (!deleteMut.isPending) setToDelete(null)
          }}
        />
      ) : null}
    </section>
  )
}
