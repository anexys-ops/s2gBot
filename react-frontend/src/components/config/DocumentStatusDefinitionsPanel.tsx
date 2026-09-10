import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  documentStatusDefinitionsApi,
  type DocumentStatusDefinitionRow,
} from '../../api/client'
import Modal from '../Modal'

const COLOR_KEYS = [
  { value: '', label: 'Par défaut' },
  { value: 'slate', label: 'Gris' },
  { value: 'amber', label: 'Ambre' },
  { value: 'orange', label: 'Orange' },
  { value: 'coral', label: 'Corail' },
  { value: 'teal', label: 'Bleu-vert' },
  { value: 'emerald', label: 'Vert' },
  { value: 'red', label: 'Rouge' },
  { value: 'violet', label: 'Violet' },
]

export default function DocumentStatusDefinitionsPanel() {
  const queryClient = useQueryClient()
  const [documentType, setDocumentType] = useState('quote')
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<DocumentStatusDefinitionRow | null>(null)

  const { data: typesRes } = useQuery({
    queryKey: ['document-status-document-types'],
    queryFn: () => documentStatusDefinitionsApi.documentTypes(),
  })

  const { data: defsRes, isLoading } = useQuery({
    queryKey: ['document-status-definitions', documentType],
    queryFn: () => documentStatusDefinitionsApi.list(documentType),
  })

  const documentTypes = typesRes?.data ?? []
  const definitions = defsRes?.data ?? []

  const deleteMut = useMutation({
    mutationFn: (id: number) => documentStatusDefinitionsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-status-definitions'] }),
  })

  return (
    <div>
      <p style={{ color: 'var(--color-muted)', maxWidth: '78ch', lineHeight: 1.5 }}>
        Gérez les statuts disponibles pour chaque type de document (libellé, ordre, statut initial ou terminal,
        couleur). Les codes techniques restent stables pour les documents déjà enregistrés.
      </p>

      <div className="card module-configuration-page__object-picker">
        <label>
          Module / type de document
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {documentTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          Ajouter un statut
        </button>
      </div>

      {isLoading ? (
        <p>Chargement…</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>
            Statuts — {documentTypes.find((t) => t.type === documentType)?.label ?? documentType}
          </h3>
          <table className="module-configuration-page__table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Libellé</th>
                <th>Ordre</th>
                <th>Initial</th>
                <th>Terminal</th>
                <th>Couleur</th>
                <th>Actif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((d) => (
                <tr key={d.id}>
                  <td>
                    <code>{d.code}</code>
                  </td>
                  <td>{d.label}</td>
                  <td>{d.sort_order}</td>
                  <td>{d.is_initial ? 'Oui' : '—'}</td>
                  <td>{d.is_terminal ? 'Oui' : '—'}</td>
                  <td>{d.color_key ?? '—'}</td>
                  <td>{d.active ? 'Oui' : 'Non'}</td>
                  <td>
                    <div className="crud-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditRow(d)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer le statut « ${d.label} » (${d.code}) ?`)) {
                            deleteMut.mutate(d.id)
                          }
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {definitions.length === 0 && <p style={{ padding: '1rem' }}>Aucun statut pour ce module.</p>}
        </div>
      )}

      {createOpen && (
        <DocumentStatusDefinitionModal
          documentType={documentType}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            queryClient.invalidateQueries({ queryKey: ['document-status-definitions'] })
          }}
        />
      )}
      {editRow && (
        <DocumentStatusDefinitionModal
          documentType={documentType}
          initial={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null)
            queryClient.invalidateQueries({ queryKey: ['document-status-definitions'] })
          }}
        />
      )}
    </div>
  )
}

function DocumentStatusDefinitionModal({
  documentType,
  initial,
  onClose,
  onSaved,
}: {
  documentType: string
  initial?: DocumentStatusDefinitionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [isInitial, setIsInitial] = useState(initial?.is_initial ?? false)
  const [isTerminal, setIsTerminal] = useState(initial?.is_terminal ?? false)
  const [colorKey, setColorKey] = useState(initial?.color_key ?? '')
  const [active, setActive] = useState(initial?.active ?? true)

  const createMut = useMutation({
    mutationFn: () =>
      documentStatusDefinitionsApi.create({
        document_type: documentType,
        code: code.trim(),
        label: label.trim(),
        sort_order: Number(sortOrder) || 0,
        is_initial: isInitial,
        is_terminal: isTerminal,
        color_key: colorKey || null,
        active,
      }),
    onSuccess: () => onSaved(),
  })

  const updateMut = useMutation({
    mutationFn: () =>
      documentStatusDefinitionsApi.update(initial!.id, {
        label: label.trim(),
        sort_order: Number(sortOrder) || 0,
        is_initial: isInitial,
        is_terminal: isTerminal,
        color_key: colorKey || null,
        active,
      }),
    onSuccess: () => onSaved(),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (initial) updateMut.mutate()
    else createMut.mutate()
  }

  const pending = createMut.isPending || updateMut.isPending
  const err = (createMut.error || updateMut.error) as Error | undefined

  return (
    <Modal title={initial ? 'Modifier le statut' : 'Nouveau statut documentaire'} onClose={onClose}>
      <form onSubmit={submit}>
        {!initial && (
          <div className="form-group">
            <label>Code technique (a-z, 0-9, _)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required pattern="[a-z0-9_]+" />
          </div>
        )}
        <div className="form-group">
          <label>Libellé affiché</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Ordre d&apos;affichage</label>
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Couleur (pastille)</label>
          <select value={colorKey} onChange={(e) => setColorKey(e.target.value)}>
            {COLOR_KEYS.map((c) => (
              <option key={c.value || 'default'} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={isInitial} onChange={(e) => setIsInitial(e.target.checked)} />
          Statut initial (création document)
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={isTerminal} onChange={(e) => setIsTerminal(e.target.checked)} />
          Statut terminal (fin de cycle)
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Actif (proposé dans les listes)
        </label>
        {err && <p className="error">{err.message}</p>}
        <div className="crud-actions">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? '…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  )
}
