import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi, clientsApi, sitesApi } from '../api/client'
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
  const navigate = useNavigate()

  useEffect(() => {
    clientsApi.list().then((list) => setClients(list)).catch(() => {})
  }, [])

  useEffect(() => {
    if (clientId) {
      sitesApi.list().then((list) => setSites(list.filter((s) => s.client_id === Number(clientId)))).catch(() => {})
    } else {
      setSites([])
      setSiteId('')
    }
  }, [clientId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    try {
      const { token } = await authApi.register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        role,
        client_id: clientId || undefined,
        site_id: siteId || undefined,
      })
      localStorage.setItem('token', token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="container" style={{ maxWidth: 480, marginTop: '3rem', width: '100%' }}>
      <PublicContextNav extraLink={{ to: '/login', label: 'Connexion' }} variant="light" />
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Inscription - Lab BTP</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirmer le mot de passe</label>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Profil</label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'client' | 'site_contact')}>
              <option value="client">Client</option>
              <option value="site_contact">Contact chantier</option>
            </select>
          </div>
          <div className="form-group">
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">-- Choisir --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {role === 'site_contact' && (
            <div className="form-group">
              <label>Chantier</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">-- Choisir --</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary">
            S'inscrire
          </button>
        </form>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/login">Déjà un compte ? Connexion</Link>
        </p>
      </div>
      <AppVersionFooter variant="app" />
    </div>
  )
}
