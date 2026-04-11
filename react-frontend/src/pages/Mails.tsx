import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mailApi, mailTemplatesApi, type MailTemplate } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

export default function Mails() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('')
  const [tplModal, setTplModal] = useState<'create' | 'edit' | null>(null)
  const [tplForm, setTplForm] = useState({ name: '', subject: '', body: '', description: '' })
  const [editingTplId, setEditingTplId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data: templatesData, isLoading: tplLoading } = useQuery({
    queryKey: ['mail-templates'],
    queryFn: () => mailTemplatesApi.list(),
    enabled: isLab,
  })

  const { data: logsData } = useQuery({
    queryKey: ['mail-logs'],
    queryFn: () => mailApi.logs(),
    enabled: isLab,
  })

  const sendMutation = useMutation({
    mutationFn: (payload: { to: string; subject: string; body: string; template_name?: string }) =>
      mailApi.send(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-logs'] })
      setTo('')
      setSubject('')
      setBody('')
      setSelectedTemplate('')
    },
  })

  const createTplMut = useMutation({
    mutationFn: () =>
      mailTemplatesApi.create({
        name: tplForm.name.trim(),
        subject: tplForm.subject,
        body: tplForm.body,
        description: tplForm.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-templates'] })
      setTplModal(null)
      setTplForm({ name: '', subject: '', body: '', description: '' })
    },
  })

  const updateTplMut = useMutation({
    mutationFn: () =>
      mailTemplatesApi.update(editingTplId!, {
        name: tplForm.name.trim(),
        subject: tplForm.subject,
        body: tplForm.body,
        description: tplForm.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-templates'] })
      setTplModal(null)
      setEditingTplId(null)
      setTplForm({ name: '', subject: '', body: '', description: '' })
    },
  })

  const deleteTplMut = useMutation({
    mutationFn: (id: number) => mailTemplatesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail-templates'] }),
  })

  const templates = templatesData?.data ?? []
  const logs = logsData?.data ?? []

  const applyTemplate = (id: number) => {
    const t = templates.find((x) => x.id === id)
    if (t) {
      setSubject(t.subject)
      setBody(t.body)
      setSelectedTemplate(id)
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!to || !subject || !body) return
    const t = selectedTemplate ? templates.find((x) => x.id === selectedTemplate) : null
    sendMutation.mutate({
      to,
      subject,
      body,
      template_name: t?.name,
    })
  }

  const openCreateTpl = () => {
    setEditingTplId(null)
    setTplForm({ name: '', subject: '', body: '', description: '' })
    setTplModal('create')
  }

  const openEditTpl = (t: MailTemplate) => {
    setEditingTplId(t.id)
    setTplForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      description: t.description ?? '',
    })
    setTplModal('edit')
  }

  const submitTpl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tplForm.name.trim() || !tplForm.subject || !tplForm.body) return
    if (tplModal === 'create') createTplMut.mutate()
    else if (tplModal === 'edit' && editingTplId) updateTplMut.mutate()
  }

  if (!isLab) {
    return (
      <div>
        <h1>Gestion des mails</h1>
        <p>Accès réservé au back office.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Gestion des mails</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <h3>Envoyer un e-mail</h3>
          <form onSubmit={handleSend}>
            <div className="form-group">
              <label>Modèle (optionnel)</label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const v = e.target.value
                  if (v !== '') applyTemplate(Number(v))
                }}
              >
                <option value="">— Aucun —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Destinataire *</label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                placeholder="email@exemple.fr"
              />
            </div>
            <div className="form-group">
              <label>Objet *</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Message *</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={sendMutation.isPending || !to || !subject || !body}>
              {sendMutation.isPending ? 'Envoi...' : 'Envoyer'}
            </button>
            {sendMutation.isError && <p className="error">{(sendMutation.error as Error).message}</p>}
            {sendMutation.isSuccess && <p style={{ color: 'green' }}>E-mail envoyé.</p>}
          </form>
        </div>
        <div className="card">
          <div className="crud-actions" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, flex: 1 }}>Modèles</h3>
            {isAdmin && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreateTpl}>
                Nouveau modèle
              </button>
            )}
          </div>
          {tplLoading && <p>Chargement…</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {templates.map((t) => (
              <li key={t.id} style={{ marginBottom: '0.75rem' }}>
                <strong>{t.name}</strong>
                {t.description && <span style={{ color: '#666', marginLeft: '0.5rem' }}>— {t.description}</span>}
                <div className="crud-actions" style={{ marginTop: '0.35rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyTemplate(t.id)}>
                    Utiliser
                  </button>
                  {isAdmin && (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditTpl(t)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer le modèle « ${t.name} » ?`)) deleteTplMut.mutate(t.id)
                        }}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!tplLoading && templates.length === 0 && <p>Aucun modèle.</p>}
        </div>
      </div>
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3>Historique des envois</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Destinataire</th>
              <th>Objet</th>
              <th>Modèle</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.sent_at).toLocaleString('fr-FR')}</td>
                <td>{log.to}</td>
                <td>{log.subject}</td>
                <td>{log.template_name ?? '—'}</td>
                <td>
                  {log.status === 'sent' ? (
                    <span style={{ color: 'green' }}>Envoyé</span>
                  ) : (
                    <span className="error" title={log.error_message ?? ''}>
                      Échec
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p style={{ padding: '1rem' }}>Aucun envoi enregistré.</p>}
      </div>

      {tplModal && isAdmin && (
        <Modal title={tplModal === 'create' ? 'Nouveau modèle' : 'Modifier le modèle'} onClose={() => setTplModal(null)}>
          <form onSubmit={submitTpl}>
            <div className="form-group">
              <label>Identifiant (unique) *</label>
              <input
                value={tplForm.name}
                onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))}
                required
                disabled={tplModal === 'edit'}
                placeholder="ex. devis_envoye"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                value={tplForm.description}
                onChange={(e) => setTplForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Objet *</label>
              <input
                value={tplForm.subject}
                onChange={(e) => setTplForm((f) => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Corps *</label>
              <textarea
                value={tplForm.body}
                onChange={(e) => setTplForm((f) => ({ ...f, body: e.target.value }))}
                rows={8}
                required
              />
            </div>
            {(createTplMut.isError || updateTplMut.isError) && (
              <p className="error">{(createTplMut.error || updateTplMut.error)?.message}</p>
            )}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={createTplMut.isPending || updateTplMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setTplModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
