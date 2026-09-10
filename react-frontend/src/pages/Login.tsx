import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { isPortalUser } from '../lib/portalAccess'
import AppVersionFooter from '../components/AppVersionFooter'
import { DEFAULT_APP_LOGO_ALT, DEFAULT_APP_LOGO_SRC } from '../lib/appBranding'

const DEMO_HINT = 'Compte démo : admin@lab.local — mot de passe : password'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      const u = await login(email, password)
      navigate(isPortalUser(u) ? '/portal' : '/')
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

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setForgotSubmitting(true)
    try {
      const res = await authApi.forgotPassword(forgotEmail.trim() || email.trim())
      setInfo(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.')
    } finally {
      setForgotSubmitting(false)
    }
  }

  function openForgotPanel() {
    setShowForgot(true)
    setError('')
    setInfo('')
    if (!forgotEmail && email.trim()) {
      setForgotEmail(email.trim())
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen-bg" aria-hidden />
      <div className="login-screen-geo" aria-hidden />
      <main className="login-screen-main">
        <div className="login-card">
          <div className="login-card-brand">
            <img src={DEFAULT_APP_LOGO_SRC} alt={DEFAULT_APP_LOGO_ALT} />
            <div className="login-card-brand-text">
              <p className="login-card-kicker">Plateforme S2G</p>
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
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-password">
                  Mot de passe
                </label>
                <button
                  type="button"
                  className="login-link-btn"
                  onClick={openForgotPanel}
                  disabled={submitting}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  className="login-input login-input--password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  disabled={submitting}
                >
                  {showPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            {error ? (
              <div className="login-alert" role="alert">
                {error}
              </div>
            ) : null}
            {info ? (
              <div className="login-alert login-alert--success" role="status">
                {info}
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

          {showForgot ? (
            <section className="login-forgot-panel" aria-labelledby="login-forgot-title">
              <h2 id="login-forgot-title" className="login-forgot-title">
                Renvoyer le mot de passe
              </h2>
              <p className="login-forgot-hint">
                Saisissez votre e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe.
              </p>
              <form className="login-form login-form--forgot" onSubmit={handleForgotSubmit} noValidate>
                <div className="login-field">
                  <label className="login-label" htmlFor="login-forgot-email">
                    Adresse e-mail
                  </label>
                  <input
                    id="login-forgot-email"
                    className="login-input"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="vous@exemple.fr"
                    disabled={forgotSubmitting}
                  />
                </div>
                <div className="login-forgot-actions">
                  <button type="submit" className="login-submit login-submit--secondary" disabled={forgotSubmitting}>
                    {forgotSubmitting ? 'Envoi…' : 'Envoyer le lien par e-mail'}
                  </button>
                  <button
                    type="button"
                    className="login-link-btn"
                    onClick={() => {
                      setShowForgot(false)
                      setError('')
                    }}
                    disabled={forgotSubmitting}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </section>
          ) : null}

        </div>
      </main>
      <AppVersionFooter variant="auth" demoHint={DEMO_HINT} />
    </div>
  )
}
