import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AppVersionFooter from '../components/AppVersionFooter'

const DEMO_HINT = 'Compte démo : admin@lab.local — mot de passe : password'

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
      <div className="login-screen-geo" aria-hidden />
      <main className="login-screen-main">
        <div className="login-card">
          <div className="login-card-brand">
            <img src="/logo-vertical.svg" alt="Lab BTP" />
            <div className="login-card-brand-text">
              <p className="login-card-kicker">Plateforme Lab BTP</p>
            </div>
          </div>

          <div className="login-card-header">
            <h1 className="login-card-title">Connexion</h1>
            <p className="login-card-sub">Accédez à votre espace sécurisé (commercial, terrain, laboratoire).</p>
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

            {error ? (
              <div className="login-alert" role="alert">
                {error}
              </div>
            ) : null}

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
        </div>
      </main>
      <AppVersionFooter variant="auth" demoHint={DEMO_HINT} />
    </div>
  )
}
