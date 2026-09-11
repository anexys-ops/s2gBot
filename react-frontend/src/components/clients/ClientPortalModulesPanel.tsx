import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientsApi, type Client } from '../../api/client'
import { PORTAL_MODULE_DEFAULTS, type PortalModuleKey } from '../../lib/portalAccess'

type Props = {
  clientId: number
  client: Client
  canEdit: boolean
}

export default function ClientPortalModulesPanel({ clientId, client, canEdit }: Props) {
  const queryClient = useQueryClient()
  const { data: catalog } = useQuery({
    queryKey: ['portal-module-catalog'],
    queryFn: () => clientsApi.portalCatalog(),
    staleTime: 10 * 60_000,
  })

  const [selected, setSelected] = useState<PortalModuleKey[]>(() =>
    normalizeModules(client.portal_modules),
  )

  useEffect(() => {
    setSelected(normalizeModules(client.portal_modules))
  }, [client.portal_modules])

  const saveMut = useMutation({
    mutationFn: (modules: PortalModuleKey[]) => clientsApi.syncPortalModules(clientId, modules),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    },
  })

  const modules = (catalog?.modules ?? []).map((m) => ({
    key: m.key as PortalModuleKey,
    label: m.label,
  }))

  const toggle = (key: PortalModuleKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const resetDefaults = () => setSelected([...PORTAL_MODULE_DEFAULTS])

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3 className="module-fiche-section-title" style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
        Modules portail client
      </h3>
      <p className="text-muted user-admin-form__hint" style={{ marginBottom: '1rem' }}>
        Cochez les sections visibles pour les utilisateurs <strong>client</strong> et{' '}
        <strong>contact chantier</strong> rattachés à ce tiers. Par défaut : dossiers, interventions et rapports livrés.
      </p>

      <div className="user-admin-form__checkbox-list">
        {modules.length === 0 && <p className="text-muted">Chargement du catalogue…</p>}
        {modules.map((m) => (
          <label key={m.key} className="user-admin-form__checkbox-row">
            <input
              type="checkbox"
              checked={selected.includes(m.key)}
              disabled={!canEdit || saveMut.isPending}
              onChange={() => toggle(m.key)}
            />
            <span>{m.label}</span>
          </label>
        ))}
      </div>

      {canEdit && (
        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveMut.isPending || selected.length === 0}
            onClick={() => saveMut.mutate(selected)}
          >
            {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer les modules'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetDefaults}>
            Réinitialiser (défaut)
          </button>
        </div>
      )}

      {saveMut.isError && (
        <p className="error" style={{ marginTop: '0.75rem' }}>
          Échec de l&apos;enregistrement.
        </p>
      )}
      {saveMut.isSuccess && (
        <p className="text-muted" style={{ marginTop: '0.75rem' }}>
          Modules portail mis à jour. Les utilisateurs devront se reconnecter pour rafraîchir le menu.
        </p>
      )}
    </div>
  )
}

function normalizeModules(raw: Client['portal_modules']): PortalModuleKey[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...PORTAL_MODULE_DEFAULTS]
  return raw.filter((k): k is PortalModuleKey => typeof k === 'string')
}
