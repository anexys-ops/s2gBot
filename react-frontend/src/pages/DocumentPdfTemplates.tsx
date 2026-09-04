import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentPdfTemplatesApi, type DocumentPdfTemplateRow } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import PdfLayoutConfigEditor from '../components/PdfLayoutConfigEditor'

const TYPE_LABELS: Record<string, string> = {
  quote: 'Devis',
  invoice: 'Facture',
}

function typeLabel(documentType: string): string {
  return TYPE_LABELS[documentType] ?? documentType
}

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
  const quoteRows = rows.filter((t) => t.document_type === 'quote')
  const invoiceRows = rows.filter((t) => t.document_type === 'invoice')
  const otherRows = rows.filter((t) => t.document_type !== 'quote' && t.document_type !== 'invoice')

  return (
    <div>
      <PageBackNav
        back={{ to: '/back-office', label: 'Back office' }}
        extras={[{ to: '/terrain', label: 'Terrain' }, { to: '/labo', label: 'Laboratoire' }]}
      />
      <div className="card" style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
        <p style={{ margin: 0 }}>
          Modèles PDF <strong>devis</strong> et <strong>factures</strong> : type existant, modèle par défaut, et
          personnalisation du cadre <strong>Total HT / TVA / TTC</strong> sur le PDF.
        </p>
      </div>

      <TemplateTypeTable
        title="Devis"
        rows={quoteRows}
        isAdmin={isAdmin}
        setDefaultPending={setDefaultMut.isPending}
        onSetDefault={(id) => setDefaultMut.mutate(id)}
      />
      <TemplateTypeTable
        title="Factures"
        rows={invoiceRows}
        isAdmin={isAdmin}
        setDefaultPending={setDefaultMut.isPending}
        onSetDefault={(id) => setDefaultMut.mutate(id)}
      />
      {otherRows.length > 0 ? (
        <TemplateTypeTable
          title="Autres"
          rows={otherRows}
          isAdmin={isAdmin}
          setDefaultPending={setDefaultMut.isPending}
          onSetDefault={(id) => setDefaultMut.mutate(id)}
        />
      ) : null}

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Aucun modèle (migrations / seeders Laravel).</p>
        </div>
      ) : null}

      {isAdmin &&
        rows.map((t) => (
          <details key={`cfg-${t.id}`} className="card" style={{ marginTop: '1rem' }} open={t.is_default}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Personnalisation — {typeLabel(t.document_type)} · {t.name}
              {t.is_default ? ' (défaut)' : ''}
            </summary>
            <PdfLayoutConfigEditor
              layoutConfig={(t.layout_config ?? {}) as Record<string, unknown>}
              totalsOnly
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

function TemplateTypeTable({
  title,
  rows,
  isAdmin,
  setDefaultPending,
  onSetDefault,
}: {
  title: string
  rows: DocumentPdfTemplateRow[]
  isAdmin: boolean
  setDefaultPending: boolean
  onSetDefault: (id: number) => void
}) {
  if (rows.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Modèle</th>
            <th>Défaut</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.is_default ? 'Oui' : '—'}</td>
              {isAdmin && (
                <td>
                  {!t.is_default && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={setDefaultPending}
                      onClick={() => onSetDefault(t.id)}
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
    </div>
  )
}
