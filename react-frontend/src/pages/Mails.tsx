import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mailApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function Mails() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('')
  const queryClient = useQueryClient()

  const { data: templatesData } = useQuery({
    queryKey: ['mail-templates'],
    queryFn: () => mailApi.templates(),
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
            <label>
              Modèle (optionnel)
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const v = e.target.value
                  if (v !== '') applyTemplate(Number(v))
                }}
              >
                <option value="">— Aucun —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label>
              Destinataire *
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                placeholder="email@exemple.fr"
              />
            </label>
            <label>
              Objet *
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </label>
            <label>
              Message *
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                required
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sendMutation.isPending || !to || !subject || !body}
            >
              {sendMutation.isPending ? 'Envoi...' : 'Envoyer'}
            </button>
            {sendMutation.isError && (
              <p className="error">{(sendMutation.error as Error).message}</p>
            )}
            {sendMutation.isSuccess && <p style={{ color: 'green' }}>E-mail envoyé.</p>}
          </form>
        </div>
        <div className="card">
          <h3>Modèles disponibles</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {templates.map((t) => (
              <li key={t.id} style={{ marginBottom: '0.75rem' }}>
                <strong>{t.name}</strong>
                {t.description && <span style={{ color: '#666', marginLeft: '0.5rem' }}>— {t.description}</span>}
                <br />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: '0.25rem' }}
                  onClick={() => applyTemplate(t.id)}
                >
                  Utiliser ce modèle
                </button>
              </li>
            ))}
          </ul>
          {templates.length === 0 && <p>Aucun modèle.</p>}
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
    </div>
  )
}
