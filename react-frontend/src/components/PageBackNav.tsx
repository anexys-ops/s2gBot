import { Link } from 'react-router-dom'

export type PageBackLink = {
  to: string
  label: string
}

type Props = {
  /** Lien principal (flèche « retour ») */
  back: PageBackLink
  /** Liens secondaires (hub, espace métier…) */
  extras?: PageBackLink[]
  className?: string
}

/**
 * Lien de retour contextuel (liste parente, hub…). Accueil, retour historique et menus
 * principaux : voir `AppContextBar` dans le layout.
 */
export default function PageBackNav({ back, extras = [], className = '' }: Props) {
  return (
    <nav className={`page-back-nav ${className}`.trim()} aria-label="Navigation retour">
      <Link to={back.to} className="page-back-nav__back">
        <span className="page-back-nav__chevron" aria-hidden>
          ←
        </span>
        {back.label}
      </Link>
      {extras.length > 0 && (
        <div className="page-back-nav__extras">
          {extras.map((x) => (
            <Link key={x.to} to={x.to} className="page-back-nav__extra">
              {x.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
