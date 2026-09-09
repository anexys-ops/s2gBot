import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentPdfTemplatesApi, type DocumentPdfTemplateRow } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PageBackNav from '../components/PageBackNav'
import DocumentPdfTemplateCreateModal from '../components/pdf/DocumentPdfTemplateCreateModal'
import { DOCUMENT_PDF_TYPE_LABELS, documentPdfTypeLabel } from '../lib/documentPdfTypes'

const TYPE_ORDER = ['quote', 'invoice', 'purchase_order', 'delivery_note', 'report']

export default function DocumentPdfTemplates() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['document-pdf-templates'],
    queryFn: () => documentPdfTemplatesApi.list(),
    enabled: isLab,
  })

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      documentPdfTemplatesApi.update(id, { is_active }),
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
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    title: documentPdfTypeLabel(type),
    rows: rows.filter((t) => t.document_type === type),
  })).filter((g) => g.rows.length > 0)

  const orphanTypes = rows.filter((t) => !TYPE_ORDER.includes(t.document_type))
  if (orphanTypes.length > 0) {
    grouped.push({ type: 'other', title: 'Autres', rows: orphanTypes })
  }

  return (
    <div>
      <PageBackNav
        back={{ to: '/back-office', label: 'Back office' }}
        extras={[{ to: '/terrain', label: 'Terrain' }, { to: '/labo', label: 'Laboratoire' }]}
      />
      <div className="card" style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <p style={{ margin: 0, flex: 1 }}>
            Configurez les <strong>modèles PDF</strong> par type de document. Créez de nouveaux modèles, masquez prix,
            TVA, désignations ou affichez les références article. À l&apos;impression, seuls les modèles actifs sont proposés.
          </p>
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + Nouveau modèle
            </button>
          )}
        </div>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.88rem' }} className="text-muted">
          Types : {Object.values(DOCUMENT_PDF_TYPE_LABELS).join(' · ')}
        </p>
      </div>

      {grouped.map(({ type, title, rows: typeRows }) => (
        <TemplateTypeTable
          key={type}
          title={title}
          rows={typeRows}
          isAdmin={isAdmin}
          togglePending={toggleActiveMut.isPending}
          onToggleActive={(id, is_active) => toggleActiveMut.mutate({ id, is_active })}
        />
      ))}

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Aucun modèle (migrations / seeders Laravel).</p>
        </div>
      ) : null}

      {toggleActiveMut.isError && <p className="error">{(toggleActiveMut.error as Error).message}</p>}

      {showCreate && (
        <DocumentPdfTemplateCreateModal
          templates={rows}
          onClose={() => setShowCreate(false)}
          onCreated={(template) => {
            setShowCreate(false)
            void queryClient.invalidateQueries({ queryKey: ['document-pdf-templates'] })
            navigate(`/back-office/modeles-documents-pdf/${template.id}`)
          }}
        />
      )}
    </div>
  )
}

function TemplateTypeTable({
  title,
  rows,
  isAdmin,
  togglePending,
  onToggleActive,
}: {
  title: string
  rows: DocumentPdfTemplateRow[]
  isAdmin: boolean
  togglePending: boolean
  onToggleActive: (id: number, is_active: boolean) => void
}) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Modèle</th>
            <th>Actif</th>
            <th>Défaut</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.is_active !== false ? 'Oui' : 'Non'}</td>
              <td>{t.is_default ? 'Oui' : '—'}</td>
              {isAdmin && (
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link to={`/back-office/modeles-documents-pdf/${t.id}`} className="btn btn-secondary btn-sm">
                    Configurer
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={togglePending || (t.is_default && t.is_active !== false)}
                    onClick={() => onToggleActive(t.id, t.is_active === false)}
                  >
                    {t.is_active !== false ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
