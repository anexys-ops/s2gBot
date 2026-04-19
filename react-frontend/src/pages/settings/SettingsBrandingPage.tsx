import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { brandingApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { canManageAppConfig } from '../../lib/settingsAccess'

export default function SettingsBrandingPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const can = canManageAppConfig(user)

  const { data, isLoading, error } = useQuery({
    queryKey: ['branding'],
    queryFn: () => brandingApi.get(),
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => brandingApi.uploadLogo(file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => brandingApi.deleteLogo(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding'] })
    },
  })

  if (isLoading) return <p>Chargement…</p>
  if (error) return <p className="error">{(error as Error).message}</p>

  const logoUrl = data?.logo_url ?? null

  return (
    <div className="card" style={{ maxWidth: '52rem' }}>
      <h2 style={{ marginTop: 0 }}>Charte &amp; logo</h2>
      <p style={{ color: 'var(--color-muted)', lineHeight: 1.5 }}>
        Le logo configuré ici apparaît dans l’en-tête de l’application (si défini) et dans les PDF devis, factures et rapports
        d’essais. Formats acceptés : JPEG, PNG, SVG, Webp (3&nbsp;Mo max).
      </p>
      <div style={{ margin: '1rem 0', minHeight: 64 }}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo société" style={{ maxHeight: 72, maxWidth: 280, objectFit: 'contain' }} />
        ) : (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>Aucun logo personnalisé — le logo par défaut Lab BTP est utilisé.</p>
        )}
      </div>
      {can ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            {uploadMut.isPending ? 'Envoi…' : 'Choisir un fichier'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/svg+xml,image/webp,.jpg,.jpeg,.png,.svg,.webp"
              hidden
              disabled={uploadMut.isPending || deleteMut.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) uploadMut.mutate(f)
              }}
            />
          </label>
          {logoUrl ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={uploadMut.isPending || deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? 'Suppression…' : 'Retirer le logo'}
            </button>
          ) : null}
        </div>
      ) : (
        <p style={{ color: 'var(--color-muted)', marginBottom: 0 }}>
          Seuls l’administrateur laboratoire et les comptes avec le droit « configuration » peuvent modifier le logo.
        </p>
      )}
      {(uploadMut.isError || deleteMut.isError) && (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          {String((uploadMut.error ?? deleteMut.error) as Error)}
        </p>
      )}
    </div>
  )
}
