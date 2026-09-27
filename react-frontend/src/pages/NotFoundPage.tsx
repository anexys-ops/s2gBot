import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const location = useLocation()
  const navigate = useNavigate()

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <div className="not-found-page__card">
        <p className="not-found-page__code" aria-hidden>
          404
        </p>
        <h1 id="not-found-title" className="not-found-page__title">
          Page introuvable
        </h1>
        <p className="not-found-page__message">
          L’adresse <code>{location.pathname}</code> n’existe pas ou a été déplacée.
        </p>
        <div className="not-found-page__actions">
          <button type="button" className="btn btn-primary" onClick={handleBack}>
            Retour
          </button>
          <Link to="/" className="btn btn-secondary">
            Accueil
          </Link>
        </div>
      </div>
    </section>
  )
}
