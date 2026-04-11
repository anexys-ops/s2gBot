import { useEffect, useState } from 'react'
import {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_HREF,
  SUPPORT_SITE_HREF,
  SUPPORT_SITE_LABEL,
  SUPPORT_WHATSAPP_E164,
  SUPPORT_WHATSAPP_HREF,
} from '../config/support'

type Variant = 'app' | 'auth'

type ApiVersionPayload = {
  laravel: string
  php: string
  api: string
  app_env?: string
}

function formatBuildDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type Props = {
  variant?: Variant
  /** Barre toujours visible en bas de l’écran (app connectée) — évite de devoir scroller pour voir le statut déploiement. */
  dock?: boolean
}

/**
 * Versions : bundle front (package.json, git, build) + API Laravel / PHP (GET /api/version).
 */
export default function AppVersionFooter({ variant = 'app', dock = false }: Props) {
  const [apiInfo, setApiInfo] = useState<ApiVersionPayload | null>(null)
  const [apiError, setApiError] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/version', { signal: ac.signal, headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error('version')
        return res.json() as Promise<ApiVersionPayload>
      })
      .then((data) => {
        if (data?.laravel && data?.php && data?.api !== undefined) setApiInfo(data)
        else setApiError(true)
      })
      .catch(() => {
        if (!ac.signal.aborted) setApiError(true)
      })
    return () => ac.abort()
  }, [])

  const frontLabel = `Frontend v${__APP_VERSION__} · commit ${__APP_GIT_SHA__} · build ${formatBuildDate(__APP_BUILD_ISO__)}`

  const envPart = apiInfo?.app_env ? ` · env ${apiInfo.app_env}` : ''
  const apiLabel = apiInfo
    ? `API v${apiInfo.api}${envPart} · Laravel ${apiInfo.laravel} · PHP ${apiInfo.php}`
    : apiError
      ? 'API : indisponible — le déploiement n’est pas complet (reverse proxy / PHP-FPM / route /api).'
      : 'API : vérification en cours…'

  const statusClass =
    apiInfo != null
      ? 'app-version-footer__status app-version-footer__status--ok'
      : apiError
        ? 'app-version-footer__status app-version-footer__status--error'
        : 'app-version-footer__status app-version-footer__status--pending'

  const statusText =
    apiInfo != null
      ? 'Déploiement OK — front servi et API /api/version joignable.'
      : apiError
        ? 'Déploiement à corriger — le front est chargé mais l’API ne répond pas.'
        : 'Validation du déploiement…'

  const dockClass = dock && variant !== 'auth' ? ' app-version-footer--dock' : ''

  return (
    <footer
      className={`app-version-footer${variant === 'auth' ? ' app-version-footer--auth' : ''}${dockClass}`}
      title={`Build ISO : ${__APP_BUILD_ISO__}`}
    >
      <div className="app-version-footer__inner">
        <div className={statusClass} role="status" aria-live="polite">
          {statusText}
        </div>
        <div className="app-version-footer__line app-version-footer__line--support">
          Support :{' '}
          <a href={SUPPORT_SITE_HREF} target="_blank" rel="noopener noreferrer">
            {SUPPORT_SITE_LABEL}
          </a>
          {' · '}
          <a href={SUPPORT_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
            WhatsApp {SUPPORT_WHATSAPP_E164}
          </a>
          {' · '}
          <a href={SUPPORT_EMAIL_HREF}>{SUPPORT_EMAIL}</a>
        </div>
        <div className="app-version-footer__line app-version-footer__line--detail">{frontLabel}</div>
        <div className="app-version-footer__line app-version-footer__line--api">{apiLabel}</div>
      </div>
    </footer>
  )
}
