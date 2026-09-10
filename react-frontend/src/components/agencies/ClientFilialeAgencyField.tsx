import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agenciesApi, type Site, type User } from '../../api/client'
import {
  filialeAgencyLabel,
  needsFilialeAgencyChoice,
  resolveDefaultFilialeAgencyId,
  selectableFilialeAgencies,
} from '../../lib/clientFilialeAgency'

type Props = {
  clientId: number
  site?: Site | null
  user?: User | null
  value?: number | null
  onChange: (agencyId: number | undefined) => void
  disabled?: boolean
  required?: boolean
  label?: string
  hint?: string
}

export default function ClientFilialeAgencyField({
  clientId,
  site,
  user,
  value,
  onChange,
  disabled = false,
  required = false,
  label = 'Agence filiale (trigramme documents)',
  hint = 'Numérotation : DEV-2026-0001/PAR — défaut du chantier ou de votre rattachement.',
}: Props) {
  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ['client-filiale-agencies', clientId],
    queryFn: () => agenciesApi.listForClient(clientId),
    enabled: clientId > 0,
  })

  const selectable = useMemo(
    () => selectableFilialeAgencies(agencies, user),
    [agencies, user],
  )

  const selectedAgency = selectable.find((a) => a.id === value) ?? agencies.find((a) => a.id === value)

  useEffect(() => {
    if (clientId <= 0 || isLoading || selectable.length === 0) return
    if (value != null && selectable.some((a) => a.id === value)) return
    const defaultId = resolveDefaultFilialeAgencyId({ site, user, agencies })
    if (defaultId != null) onChange(defaultId)
  }, [clientId, isLoading, selectable, agencies, site, user, value, onChange])

  if (clientId <= 0) return null

  if (isLoading) {
    return (
      <div className="form-group">
        <label>{label}</label>
        <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Chargement des agences…
        </p>
      </div>
    )
  }

  if (selectable.length === 0) {
    return (
      <div className="form-group">
        <label>{label}</label>
        <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Aucune agence filiale configurée pour ce client.
        </p>
      </div>
    )
  }

  const showSelect = selectable.length > 1 || needsFilialeAgencyChoice({ user, agencies: selectable, currentId: value })

  return (
    <div className="form-group">
      <label htmlFor="filiale-agency-field">{label}{required ? ' *' : ''}</label>
      {showSelect ? (
        <select
          id="filiale-agency-field"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          disabled={disabled}
          required={required}
        >
          <option value="">— Choisir —</option>
          {selectable.map((a) => (
            <option key={a.id} value={a.id}>
              {filialeAgencyLabel(a)}
            </option>
          ))}
        </select>
      ) : (
        <p style={{ margin: 0 }}>
          <strong>{filialeAgencyLabel(selectedAgency ?? selectable[0])}</strong>
        </p>
      )}
      {hint ? (
        <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
