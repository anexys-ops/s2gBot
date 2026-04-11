import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de connexion'
      setError(
        msg.includes('fetch') || msg.includes('Network')
          ? "L'API ne répond pas (Laravel sur le port 8000 ?). Démarrez : cd laravel-api && php artisan serve"
          : msg
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen-bg" aria-hidden />
      <div className="login-screen-grid" aria-hidden />
      <div className="login-screen-content">
        <div className="login-hero">
          <div className="login-hero-badge">Essais laboratoire</div>
          <h1 className="login-hero-title">Plateforme Lab BTP</h1>
          <p className="login-hero-text">
            Commandes, échantillons, résultats d&apos;essais et rapports — tout votre flux laboratoire
            matériaux et géotechnique au même endroit.
          </p>
          <ul className="login-hero-list">
            <li>Traçabilité des prélèvements</li>
            <li>Rapports &amp; facturation</li>
            <li>Conformité aux normes NF / EN</li>
          </ul>
        </div>

        <div className="login-panel">
          <div className="login-card">
            <div className="login-card-header">
              <h2 className="login-card-title">Connexion</h2>
              <p className="login-card-sub">Accédez à votre espace sécurisé</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="login-email">
                  Adresse e-mail
                </label>
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="vous@exemple.fr"
                  disabled={submitting}
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="login-password">
                  Mot de passe
                </label>
                <input
                  id="login-password"
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="login-alert" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="login-submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="login-spinner" aria-hidden />
                    Connexion en cours…
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            <p className="login-footer">
              <Link to="/register" className="login-link-register">
                Créer un compte client
              </Link>
            </p>
          </div>
          <p className="login-hint">Compte démo : admin@lab.local — mot de passe : password</p>
        </div>
      </div>
    </div>
  )
}
