import { Link, useNavigate } from 'react-router-dom'

type Props = {
  /** Lien secondaire (ex. inscription depuis login) */
  extraLink?: { to: string; label: string }
  /** `dark` : texte clair (écran login plein fond) ; `light` : fond clair (inscription) */
  variant?: 'dark' | 'light'
}

/**
 * Retour + Accueil sur les écrans hors layout (connexion, inscription).
 */
export default function PublicContextNav({ extraLink, variant = 'dark' }: Props) {
  const navigate = useNavigate()

  return (
    <nav
      className={`public-context-nav${variant === 'light' ? ' public-context-nav--light' : ''}`}
      aria-label="Navigation"
    >
      <button type="button" className="public-context-nav__btn" onClick={() => navigate(-1)}>
        ← Retour
      </button>
      <Link to="/" className="public-context-nav__link">
        Accueil
      </Link>
      {extraLink ? (
        <Link to={extraLink.to} className="public-context-nav__link">
          {extraLink.label}
        </Link>
      ) : null}
    </nav>
  )
}
