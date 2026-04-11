import { Link, useNavigate } from 'react-router-dom'

/**
 * Barre légère sous l’en-tête : navigation historique uniquement.
 * Les entrées métier (CRM, factures, rapports…) restent dans {@link AppNavigation}.
 */
export default function AppContextBar() {
  const navigate = useNavigate()

  return (
    <div className="app-context-bar" role="navigation" aria-label="Navigation page">
      <div className="app-context-bar__inner app-context-bar__inner--minimal">
        <div className="app-context-bar__primary">
          <button type="button" className="app-context-bar__btn" onClick={() => navigate(-1)}>
            ← Retour
          </button>
          <Link to="/" className="app-context-bar__btn app-context-bar__link">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
