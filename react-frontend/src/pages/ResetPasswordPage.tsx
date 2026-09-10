import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import AppVersionFooter from '../components/AppVersionFooter'
import { DEFAULT_APP_LOGO_ALT, DEFAULT_APP_LOGO_SRC } from '../lib/appBranding'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const emailFromQuery = searchParams.get('email') ?? ''
  const tokenFromQuery = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(
    () => emailFromQuery.trim() !== '' && tokenFromQuery.trim() !== '' && password.length >= 8,
    [emailFromQuery, tokenFromQuery, password.length],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      const res = await authApi.resetPassword({
        email: emailFromQuery,
        token: tokenFromQuery,
        password,
        password_confirmation: passwordConfirmation,
      })
      setSuccess(res.message)
      window.setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!emailFromQuery || !tokenFromQuery) {
    return (
      <div className="login-screen">
        <div className="login-screen-bg" aria-hidden />
        <main className="login-screen-main">
          <div className="login-card">
            <h1 className="login-card-title">Lien invalide</h1>
            <p className="login-card-sub">Ce lien de réinitialisation est incomplet ou expiré.</p>
            <Link to="/login" className="login-submit login-submit--link">
              Retour à la connexion
            </Link>
          </div>
        </main>
        <AppVersionFooter variant="auth" />
      </div>
    )
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
            <h1 className="login-card-title">Nouveau mot de passe</h1>
            <p className="login-card-sub">Choisissez un mot de passe pour {emailFromQuery}.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-label" htmlFor="reset-password">
                Nouveau mot de passe
              </label>
              <div className="login-password-wrap">
                <input
                  id="reset-password"
                  className="login-input login-input--password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="reset-password-confirm">
                Confirmer le mot de passe
              </label>
              <div className="login-password-wrap">
                <input
                  id="reset-password-confirm"
                  className="login-input login-input--password"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPasswordConfirm((v) => !v)}
                  aria-label={showPasswordConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                >
                  {showPasswordConfirm ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </div>

            {error ? (
              <div className="login-alert" role="alert">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="login-alert login-alert--success" role="status">
                {success}
              </div>
            ) : null}

            <button type="submit" className="login-submit" disabled={submitting || !canSubmit}>
              {submitting ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </form>

          <p className="login-forgot-back">
            <Link to="/login">Retour à la connexion</Link>
          </p>
        </div>
      </main>
      <AppVersionFooter variant="auth" />
    </div>
  )
}
