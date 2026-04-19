import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportPdfTemplatesApi, type ReportPdfTemplateRow } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import PdfLayoutConfigEditor from '../components/PdfLayoutConfigEditor'

export default function ReportPdfTemplates() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-pdf-templates'],
    queryFn: () => reportPdfTemplatesApi.list(),
    enabled: isLab,
  })

  const setDefaultMut = useMutation({
    mutationFn: (id: number) => reportPdfTemplatesApi.update(id, { is_default: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report-pdf-templates'] }),
  })

  const saveLayoutMut = useMutation({
    mutationFn: ({ id, layout_config }: { id: number; layout_config: Record<string, unknown> }) =>
      reportPdfTemplatesApi.update(id, { layout_config }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report-pdf-templates'] }),
  })

  if (!isLab) {
    return (
      <div>
        <PageBackNav back={{ to: '/terrain', label: 'Terrain & labo' }} />
        <p>Accès réservé au laboratoire.</p>
      </div>
    )
  }

  if (isLoading) return <p>Chargement…</p>
  if (error) return <p className="error">{String(error)}</p>

  const rows: ReportPdfTemplateRow[] = data?.data ?? []

  return (
    <div>
      <PageBackNav
        back={{ to: '/back-office', label: 'Back office' }}
        extras={[{ to: '/terrain', label: 'Terrain & labo' }]}
      />
      <div className="card" style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
        <p style={{ margin: 0 }}>
          Choix du modèle <strong>par défaut</strong> pour les rapports PDF depuis une commande. Les administrateurs peuvent
          configurer la mise en page (exports, en-tête, champs et photos) dans le panneau graphique ci-dessous — enregistré
          côté serveur avec fusion des valeurs par défaut.
        </p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
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
        {rows.length === 0 && <p style={{ padding: '1rem' }}>Aucun modèle (exécutez les migrations / seeders Laravel).</p>}
      </div>
      {isAdmin &&
        rows.map((t) => (
          <details key={`cfg-${t.id}`} className="card" style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Mise en page — {t.name}
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
