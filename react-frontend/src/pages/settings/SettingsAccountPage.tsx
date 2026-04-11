import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { accountApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function SettingsAccountPage() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone ?? '')
  }, [user])

  const saveMut = useMutation({
    mutationFn: () => accountApi.updateProfile({ name, email, phone: phone.trim() || null }),
    onSuccess: (u) => setUser(u),
  })

  if (!user) return null

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2 style={{ marginTop: 0 }}>Profil</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          saveMut.mutate()
        }}
      >
        <div className="form-group">
          <label>Nom affiché</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Adresse e-mail (connexion)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Téléphone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optionnel" />
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          Rôle actuel : <strong>{user.role}</strong>
          {user.client?.name ? ` · Client : ${user.client.name}` : null}
          {user.site?.name ? ` · Chantier : ${user.site.name}` : null}
        </p>
        {saveMut.isError && <p className="error">{(saveMut.error as Error).message}</p>}
        <button type="submit" className="btn btn-primary" disabled={saveMut.isPending}>
          {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
