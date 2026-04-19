import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/client'
import AppVersionFooter from '../components/AppVersionFooter'
import PublicContextNav from '../components/PublicContextNav'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [role, setRole] = useState<'client' | 'site_contact'>('client')
  const [clientId, setClientId] = useState<number | ''>('')
  const [siteId, setSiteId] = useState<number | ''>('')
  const [clients, setClients] = useState<Array<{ id: number; name: string }>>([])
  const [sites, setSites] = useState<Array<{ id: number; name: string; client_id: number }>>([])
  const [error, setError] = useState('')
  const [clientsError, setClientsError] = useState('')
  const [loadingClients, setLoadingClients] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setLoadingClients(true)
    setClientsError('')
    authApi
      .registerClients()
      .then((list) => {
        if (!cancelled) setClients(list)
      })
      .catch(() => {
        if (!cancelled) {
          setClients([])
          setClientsError('Impossible de charger les entreprises. Vérifiez la connexion ou réessayez plus tard.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingClients(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!clientId) {
      setSites([])
      setSiteId('')
      return
    }
    let cancelled = false
    authApi
      .registerSites(Number(clientId))
      .then((list) => {
        if (!cancelled) setSites(list)
      })
      .catch(() => {
        if (!cancelled) {
          setSites([])
          setSiteId('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (!clientId) {
      setError('Choisissez votre entreprise (client) dans la liste.')
      return
    }
    if (role === 'site_contact' && !siteId) {
      setError('Choisissez le chantier rattaché à votre compte.')
      return
    }
    setSubmitting(true)
    try {
      const { token } = await authApi.register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        role,
        client_id: Number(clientId),
        site_id: role === 'site_contact' ? Number(siteId) : undefined,
      })
      localStorage.setItem('token', token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="register-screen">
      <div className="register-screen-bg" aria-hidden />
      <div className="register-screen-blueprint" aria-hidden />
      <div className="register-screen-tools" aria-hidden>
        <svg className="register-tools-svg" viewBox="0 0 520 380" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M40 48h168M40 62h132M40 76h152" opacity="0.85" />
            <rect x="268" y="34" width="168" height="56" rx="8" opacity="0.5" />
            <path d="M56 140v132M56 206h112M104 140v132" opacity="0.45" />
            <path d="M320 118l44 76H276l44-76z" opacity="0.35" />
            <circle cx="392" cy="232" r="46" opacity="0.32" />
            <path d="M72 300h196M72 318h156M72 336h208" opacity="0.4" />
            <path d="M380 280l72 48M380 328l72-48" opacity="0.38" />
          </g>
        </svg>
      </div>

      <div className="register-screen-content">
        <div className="register-screen-topbar">
          <PublicContextNav extraLink={{ to: '/login', label: 'Connexion' }} variant="dark" />
        </div>

        <div className="register-hero">
          <div className="register-hero-badge">Création de compte</div>
          <h1 className="register-hero-title">Rejoignez la plateforme Lab BTP</h1>
          <p className="register-hero-text">
            Accédez aux commandes d&apos;essais, suivez vos chantiers et récupérez vos rapports — le même espace que
            vos équipes laboratoire.
          </p>
          <ul className="register-hero-list">
            <li>Choisissez votre entreprise puis votre profil</li>
            <li>Contact chantier : rattachement à un site précis</li>
            <li>Données protégées, accès personnalisé</li>
          </ul>
        </div>

        <div className="register-panel">
          <div className="login-card">
            <div className="login-card-header">
              <h2 className="login-card-title">Inscription</h2>
              <p className="login-card-sub">Complétez le formulaire pour activer votre accès</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {clientsError && (
                <div className="login-alert" role="alert">
                  {clientsError}
                </div>
              )}

              <div className="login-field">
                <label className="login-label" htmlFor="reg-name">
                  Nom
                </label>
                <input
                  id="reg-name"
                  className="login-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  disabled={submitting}
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-email">
                  E-mail
                </label>
                <input
                  id="reg-email"
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={submitting}
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-password">
                  Mot de passe
                </label>
                <input
                  id="reg-password"
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-password2">
                  Confirmer le mot de passe
                </label>
                <input
                  id="reg-password2"
                  className="login-input"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="reg-role">
                  Profil
                </label>
                <select
                  id="reg-role"
                  className="login-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'client' | 'site_contact')}
                  disabled={submitting}
                >
                  <option value="client">Client (entreprise)</option>
                  <option value="site_contact">Contact chantier</option>
                </select>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="reg-client">
                  Entreprise (client)
                </label>
                <select
                  id="reg-client"
                  className="login-input"
                  value={clientId === '' ? '' : String(clientId)}
                  onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}
                  required
                  disabled={submitting || loadingClients || clients.length === 0}
                >
                  <option value="">{loadingClients ? 'Chargement…' : '— Choisir —'}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {role === 'site_contact' && (
                <div className="login-field">
                  <label className="login-label" htmlFor="reg-site">
                    Chantier
                  </label>
                  <select
                    id="reg-site"
                    className="login-input"
                    value={siteId === '' ? '' : String(siteId)}
                    onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : '')}
                    required
                    disabled={submitting || !clientId || sites.length === 0}
                  >
                    <option value="">{!clientId ? '— Choisir une entreprise d’abord —' : '— Choisir un chantier —'}</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="login-alert" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="login-submit" disabled={submitting || loadingClients || clients.length === 0}>
                {submitting ? (
                  <>
                    <span className="login-spinner" aria-hidden />
                    Création du compte…
                  </>
                ) : (
                  "S'inscrire"
                )}
              </button>
            </form>

            <p className="login-footer">
              <Link to="/login" className="login-link-register">
                Déjà un compte ? Connexion
              </Link>
            </p>
          </div>
        </div>
      </div>
      <AppVersionFooter variant="auth" />
    </div>
  )
}
