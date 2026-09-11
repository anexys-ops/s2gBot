import type { ReactNode } from 'react'
import { errorMessage } from '../../lib/errors'

type Props = {
  error: unknown
  fallback?: string
  title?: string
  onRetry?: () => void
  children?: ReactNode
}

export default function ErrorAlert({
  error,
  fallback = 'Une erreur est survenue.',
  title,
  onRetry,
  children,
}: Props) {
  if (!error) return null
  const message = errorMessage(error, fallback)

  return (
    <div className="app-error-alert" role="alert">
      {title ? <strong className="app-error-alert__title">{title}</strong> : null}
      <p className="app-error-alert__message">{message}</p>
      {children}
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm app-error-alert__retry" onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  )
}
