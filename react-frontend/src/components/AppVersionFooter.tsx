type Variant = 'app' | 'auth'

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
}

/**
 * Version du bundle (package.json), hash Git au moment du `vite build`, date de build.
 * Permet de vérifier après un déploiement que le navigateur charge bien le nouveau front.
 */
export default function AppVersionFooter({ variant = 'app' }: Props) {
  const label = `Frontend v${__APP_VERSION__} · ${__APP_GIT_SHA__} · build ${formatBuildDate(__APP_BUILD_ISO__)}`
  return (
    <footer
      className={`app-version-footer${variant === 'auth' ? ' app-version-footer--auth' : ''}`}
      title={`Build ISO : ${__APP_BUILD_ISO__}`}
    >
      <span className="app-version-footer__inner">{label}</span>
    </footer>
  )
}
