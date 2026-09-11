import { Link } from 'react-router-dom'
import { errorMessage, isAppError } from '../../lib/errors'

type Props = {
  error: unknown
  fallback?: string
  backTo?: string
  backLabel?: string
  onRetry?: () => void
}

export default function PageErrorState({
  error,
  fallback = 'Impossible de charger cette page.',
  backTo,
  backLabel = 'Retour',
  onRetry,
}: Props) {
  const message = errorMessage(error, fallback)
  const status = isAppError(error) ? error.status : undefined

  return (
    <div className="app-page-error" role="alert">
      {status ? <p className="app-page-error__code">Erreur {status}</p> : null}
      <p className="app-page-error__message">{message}</p>
      <div className="app-page-error__actions">
        {onRetry ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
            Réessayer
          </button>
        ) : null}
        {backTo ? (
          <Link to={backTo} className="btn btn-secondary btn-sm">
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
