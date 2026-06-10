import { useState } from 'react'
import { quotesApi } from '../../../api/client'

type Props = {
  quoteId: number
  quoteNumber: string
  contactEmail?: string
  onDone: () => void
}

type SendState = 'idle' | 'loading' | 'success' | 'error'

export default function WizardStep6Send({ quoteId, quoteNumber, contactEmail, onDone }: Props) {
  const [sendState, setSendState] = useState<SendState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSendEmail = async () => {
    setSendState('loading')
    setErrorMsg('')
    try {
      await quotesApi.sendEmail(quoteId)
      setSendState('success')
    } catch (err) {
      setSendState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    }
  }

  return (
    <div className="qw-body">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>✓</div>
        <h2 style={{ fontWeight: 700, color: '#16a34a', marginBottom: '.25rem' }}>
          Devis créé avec succès
        </h2>
        <p style={{ color: '#6b7280' }}>
          Devis <strong>{quoteNumber}</strong> enregistré.
        </p>
      </div>

      {contactEmail && (
        <div className="qw-send-card">
          <p className="qw-send-card__title">Envoyer par email</p>
          <p style={{ fontSize: '.9rem', color: '#374151', marginBottom: '1rem' }}>
            Destinataire : <strong>{contactEmail}</strong>
          </p>
          {sendState === 'success' ? (
            <p style={{ color: '#16a34a', fontWeight: 600 }}>
              Email envoyé avec succes.
            </p>
          ) : (
            <button
              type="button"
              className="qw-nav__submit"
              onClick={handleSendEmail}
              disabled={sendState === 'loading'}
              style={{ fontSize: '.9rem', padding: '.55rem 1.4rem' }}
            >
              {sendState === 'loading' ? 'Envoi…' : 'Envoyer par email'}
            </button>
          )}
          {sendState === 'error' && (
            <p style={{ color: '#dc2626', fontSize: '.88rem', marginTop: '.5rem' }}>{errorMsg}</p>
          )}
        </div>
      )}

      <div className="qw-send-card">
        <p className="qw-send-card__title">Continuer sans envoyer</p>
        <p style={{ fontSize: '.88rem', color: '#6b7280', marginBottom: '1rem' }}>
          Vous pouvez envoyer le devis plus tard depuis la liste des devis.
        </p>
        <button type="button" className="qw-nav__back" onClick={onDone}>
          Continuer sans envoyer
        </button>
      </div>
    </div>
  )
}
