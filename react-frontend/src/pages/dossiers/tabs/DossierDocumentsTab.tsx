import { useOutletContext } from 'react-router-dom'
import { attachmentsApi } from '../../../api/client'
import { useQuery } from '@tanstack/react-query'
import type { DossierFicheOutletContext } from '../DossierFichePage'

export default function DossierDocumentsTab() {
  const { dossier, dossierId } = useOutletContext<DossierFicheOutletContext>()

  const { data, isLoading } = useQuery({
    queryKey: ['attachments', 'dossier', dossierId],
    queryFn: () => attachmentsApi.list('dossier', dossierId),
  })

  return (
    <div>
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Fichiers rattachés au dossier (table standard <code>attachments</code>).
      </p>
      {dossier.attachments && dossier.attachments.length > 0 && (
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          {dossier.attachments.length} pièce(s) chargée(s) avec la fiche.
        </p>
      )}
      {isLoading && <p className="text-muted">Chargement…</p>}
      {data && data.length === 0 && <p className="text-muted">Aucun document pour ce dossier.</p>}
      {data && data.length > 0 && (
        <ul className="list-plain" style={{ listStyle: 'none', padding: 0 }}>
          {data.map((a) => (
            <li key={a.id} style={{ marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="link-inline"
                onClick={() => attachmentsApi.download(a.id, a.original_filename)}
              >
                {a.original_filename}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
