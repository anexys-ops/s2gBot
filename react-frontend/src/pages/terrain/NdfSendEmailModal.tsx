import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { documentPdfTemplatesApi, expenseReportsApi, type ExpenseReport } from '../../api/client'
import Modal from '../../components/Modal'
import { useAuth } from '../../contexts/AuthContext'

type Props = {
  report: ExpenseReport
  onClose: () => void
}

export default function NdfSendEmailModal({ report, onClose }: Props) {
  const { user } = useAuth()
  const [recipientEmail, setRecipientEmail] = useState(user?.email ?? '')
  const [recipientName, setRecipientName] = useState(user?.name ?? '')
  const [message, setMessage] = useState('')
  const [templateId, setTemplateId] = useState<number | null>(null)

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['document-pdf-templates', 'expense_report', 'active'],
    queryFn: () => documentPdfTemplatesApi.list('expense_report', true),
  })

  const templates = templatesData?.data ?? []
  const defaultTemplateId = useMemo(() => {
    const def = templates.find((t) => t.is_default)
    return def?.id ?? templates[0]?.id ?? null
  }, [templates])

  const selectedTemplateId = templateId ?? defaultTemplateId

  const sendMut = useMutation({
    mutationFn: () =>
      expenseReportsApi.sendEmail(report.id, {
        recipient_email: recipientEmail.trim(),
        recipient_name: recipientName.trim() || undefined,
        message: message.trim() || undefined,
        pdf_template_id: selectedTemplateId ?? undefined,
      }),
    onSuccess: onClose,
  })

  return (
    <Modal title={`Envoyer ${report.unique_number} par e-mail`} onClose={onClose}>
      <p style={{ marginTop: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
        Un PDF reprenant toutes les lignes sera joint au message.
      </p>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.65rem', fontSize: '0.82rem', fontWeight: 600 }}>
        Destinataire (e-mail) *
        <input type="email" className="input" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.65rem', fontSize: '0.82rem', fontWeight: 600 }}>
        Nom du destinataire
        <input className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.65rem', fontSize: '0.82rem', fontWeight: 600 }}>
        Modèle PDF
        {templatesLoading ? (
          <span className="text-muted">Chargement…</span>
        ) : templates.length === 0 ? (
          <span className="text-muted">Aucun modèle actif — configurez-en un dans Modèles PDF.</span>
        ) : (
          <select
            className="input"
            value={selectedTemplateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (défaut)' : ''}
              </option>
            ))}
          </select>
        )}
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.65rem', fontSize: '0.82rem', fontWeight: 600 }}>
        Message (optionnel)
        <textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {sendMut.isError ? (
        <p className="error" style={{ fontSize: '0.85rem' }}>{(sendMut.error as Error).message}</p>
      ) : null}
      <div className="crud-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={sendMut.isPending || !recipientEmail.trim() || templates.length === 0}
          onClick={() => sendMut.mutate()}
        >
          {sendMut.isPending ? 'Envoi…' : 'Envoyer avec PDF'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={sendMut.isPending} onClick={onClose}>Annuler</button>
      </div>
    </Modal>
  )
}
