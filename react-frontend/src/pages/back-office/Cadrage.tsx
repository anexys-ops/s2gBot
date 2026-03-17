import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cadrageApi, type CadragePayload } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function Cadrage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'

  const { data, isLoading, error } = useQuery({
    queryKey: ['cadrage'],
    queryFn: () => cadrageApi.get(),
  })

  const updateMutation = useMutation({
    mutationFn: (body: Partial<CadragePayload>) => cadrageApi.update(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cadrage'] }),
  })

  const toggleTypes = (value: string) => {
    const current = data?.types_essais_demarrage ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    updateMutation.mutate({ types_essais_demarrage: next })
  }

  const toggleNormes = (value: string) => {
    const current = data?.normes_referentiels ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    updateMutation.mutate({ normes_referentiels: next })
  }

  const setPerimetre = (value: string) => {
    updateMutation.mutate({ perimetre: value })
  }

  const setTracabilite = (key: 'audit_trail' | 'signatures' | 'etalonnages', checked: boolean) => {
    const current = data?.tracabilite_iso17025 ?? {}
    updateMutation.mutate({
      tracabilite_iso17025: { ...current, [key]: checked },
    })
  }

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur : {String(error)}</p>

  const options = data?.options ?? {
    types_essais_demarrage: [],
    normes_referentiels: [],
    perimetre: [],
  }

  return (
    <div>
      <h1>LIMS BTP — Cadrage (Semaine 0)</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Objectif : couvrir le flux de bout en bout (demande → prélèvement → essai → résultats → rapport → facturation).
        À clarifier avant de démarrer.
      </p>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>1) Types d’essais visés au démarrage</h2>
        <p>Cocher les familles d’essais à gérer en premier.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
          {(options.types_essais_demarrage || []).map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="checkbox"
                checked={(data?.types_essais_demarrage ?? []).includes(opt.value)}
                onChange={() => toggleTypes(opt.value)}
                disabled={!isAdmin}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>2) Normes / référentiels à intégrer</h2>
        <p>NF/EN/ASTM, méthodes internes.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
          {(options.normes_referentiels || []).map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="checkbox"
                checked={(data?.normes_referentiels ?? []).includes(opt.value)}
                onChange={() => toggleNormes(opt.value)}
                disabled={!isAdmin}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>3) Périmètre</h2>
        <p>1 labo ou multi-sites ? mobile (chantier) ?</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
          {(options.perimetre || []).map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="radio"
                name="perimetre"
                checked={(data?.perimetre ?? '') === opt.value}
                onChange={() => setPerimetre(opt.value)}
                disabled={!isAdmin}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>4) Traçabilité exigée (ISO 17025)</h2>
        <p>Audit trail, signatures, étalonnages.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={data?.tracabilite_iso17025?.audit_trail ?? false}
              onChange={(e) => setTracabilite('audit_trail', e.target.checked)}
              disabled={!isAdmin}
            />
            Audit trail (historique des actions)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={data?.tracabilite_iso17025?.signatures ?? false}
              onChange={(e) => setTracabilite('signatures', e.target.checked)}
              disabled={!isAdmin}
            />
            Signatures (validation des résultats)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={data?.tracabilite_iso17025?.etalonnages ?? false}
              onChange={(e) => setTracabilite('etalonnages', e.target.checked)}
              disabled={!isAdmin}
            />
            Étalonnages (suivi équipements)
          </label>
        </div>
      </div>

      {updateMutation.isSuccess && <p style={{ color: 'green' }}>Enregistré.</p>}
      {updateMutation.isError && <p className="error">{(updateMutation.error as Error).message}</p>}
    </div>
  )
}
