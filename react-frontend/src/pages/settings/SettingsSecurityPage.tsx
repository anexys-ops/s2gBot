import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountApi } from '../../api/client'

export default function SettingsSecurityPage() {
  const queryClient = useQueryClient()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [newTokenName, setNewTokenName] = useState('')
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  const { data: tokensRes, isLoading } = useQuery({
    queryKey: ['user-api-tokens'],
    queryFn: () => accountApi.listApiTokens(),
  })
  const tokens = tokensRes?.data ?? []

  const pwdMut = useMutation({
    mutationFn: () =>
      accountApi.updatePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirmation('')
    },
  })

  const createTokMut = useMutation({
    mutationFn: () => accountApi.createApiToken(newTokenName.trim()),
    onSuccess: (res) => {
      setRevealedToken(res.token)
      setNewTokenName('')
      queryClient.invalidateQueries({ queryKey: ['user-api-tokens'] })
    },
  })

  const revokeMut = useMutation({
    mutationFn: (id: number) => accountApi.revokeApiToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-api-tokens'] }),
  })

  return (
    <div className="settings-security-grid">
      <div className="card" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>Mot de passe</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            pwdMut.mutate()
          }}
        >
          <div className="form-group">
            <label>Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="form-group">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirmation</label>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {pwdMut.isError && <p className="error">{(pwdMut.error as Error).message}</p>}
          {pwdMut.isSuccess && <p style={{ color: 'var(--color-ok, #059669)' }}>{pwdMut.data.message}</p>}
          <button type="submit" className="btn btn-primary" disabled={pwdMut.isPending}>
            {pwdMut.isPending ? '…' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      </div>

      <div className="card" style={{ minWidth: 0 }}>
        <h2 style={{ marginTop: 0 }}>Clés API (Sanctum)</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Utilisez un jeton nommé pour les intégrations (scripts, mobile, n8n…). En-tête{' '}
          <code>Authorization: Bearer &lt;token&gt;</code>. Le jeton nommé <strong>spa</strong> sert à la session web et ne
          peut pas être révoqué ici.
        </p>
        <form
          className="crud-actions"
          style={{ flexWrap: 'wrap', marginBottom: '1rem' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (!newTokenName.trim()) return
            createTokMut.mutate()
          }}
        >
          <input
            style={{ flex: '1 1 200px', minWidth: 0 }}
            placeholder="ex. intégration-n8n"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={createTokMut.isPending || !newTokenName.trim()}>
            Générer un jeton
          </button>
        </form>
        {createTokMut.isError && <p className="error">{(createTokMut.error as Error).message}</p>}
        {revealedToken && (
          <div className="card" style={{ background: 'var(--color-accent-soft, #eff6ff)', marginBottom: '1rem' }}>
            <strong>Copiez ce jeton maintenant</strong> (il ne sera plus affiché) :
            <pre
              style={{
                margin: '0.5rem 0 0',
                padding: '0.65rem',
                background: '#fff',
                borderRadius: 8,
                overflow: 'auto',
                fontSize: '0.8rem',
                wordBreak: 'break-all',
              }}
            >
              {revealedToken}
            </pre>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRevealedToken(null)}>
              J’ai copié le jeton
            </button>
          </div>
        )}
        {isLoading ? (
          <p>Chargement…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Créé le</th>
                  <th>Dernière utilisation</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.name}
                      {t.is_spa ? <span style={{ color: 'var(--color-muted)', marginLeft: 6 }}>(session web)</span> : null}
                    </td>
                    <td>{new Date(t.created_at).toLocaleString('fr-FR')}</td>
                    <td>{t.last_used_at ? new Date(t.last_used_at).toLocaleString('fr-FR') : '—'}</td>
                    <td>
                      {!t.is_spa ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          disabled={revokeMut.isPending}
                          onClick={() => {
                            if (window.confirm(`Révoquer le jeton « ${t.name} » ?`)) revokeMut.mutate(t.id)
                          }}
                        >
                          Révoquer
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
