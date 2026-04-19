import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentPdfTemplatesApi, type DocumentPdfTemplateRow } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import PdfLayoutConfigEditor from '../components/PdfLayoutConfigEditor'

export default function DocumentPdfTemplates() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['document-pdf-templates'],
    queryFn: () => documentPdfTemplatesApi.list(),
    enabled: isLab,
  })

  const setDefaultMut = useMutation({
    mutationFn: (id: number) => documentPdfTemplatesApi.update(id, { is_default: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-pdf-templates'] }),
  })

  const saveLayoutMut = useMutation({
    mutationFn: ({ id, layout_config }: { id: number; layout_config: Record<string, unknown> }) =>
      documentPdfTemplatesApi.update(id, { layout_config }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-pdf-templates'] }),
  })

  if (!isLab) {
    return (
      <div>
        <PageBackNav back={{ to: '/labo', label: 'Laboratoire' }} />
        <p>Accès réservé au laboratoire.</p>
      </div>
    )
  }

  if (isLoading) return <p>Chargement…</p>
  if (error) return <p className="error">{String(error)}</p>

  const rows: DocumentPdfTemplateRow[] = data?.data ?? []

  return (
    <div>
      <PageBackNav
        back={{ to: '/back-office', label: 'Back office' }}
        extras={[{ to: '/terrain', label: 'Terrain' }, { to: '/labo', label: 'Laboratoire' }]}
      />
      <div className="card" style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
        <p style={{ margin: 0 }}>
          Modèles PDF pour les <strong>devis</strong> et <strong>factures</strong> : modèle par défaut par type de document, et mise en page
          (logo, signature, champs supplémentaires) partagée avec la génération côté serveur.
        </p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Nom</th>
              <th>Slug</th>
              <th>Vue Blade</th>
              <th>Défaut</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <code>{t.document_type}</code>
                </td>
                <td>{t.name}</td>
                <td>
                  <code>{t.slug}</code>
                </td>
                <td>
                  <code>{t.blade_view}</code>
                </td>
                <td>{t.is_default ? 'Oui' : '—'}</td>
                {isAdmin && (
                  <td>
                    {!t.is_default && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={setDefaultMut.isPending}
                        onClick={() => setDefaultMut.mutate(t.id)}
                      >
                        Définir par défaut
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p style={{ padding: '1rem' }}>Aucun modèle (migrations / seeders Laravel).</p>}
      </div>
      {isAdmin &&
        rows.map((t) => (
          <details key={`cfg-${t.id}`} className="card" style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Mise en page — {t.name} ({t.document_type})
            </summary>
            <PdfLayoutConfigEditor
              layoutConfig={(t.layout_config ?? {}) as Record<string, unknown>}
              disabled={saveLayoutMut.isPending}
              onSave={async (parsed) => {
                await saveLayoutMut.mutateAsync({ id: t.id, layout_config: parsed })
              }}
            />
          </details>
        ))}
      {setDefaultMut.isError && <p className="error">{(setDefaultMut.error as Error).message}</p>}
      {saveLayoutMut.isError && <p className="error">{(saveLayoutMut.error as Error).message}</p>}
    </div>
  )
}
