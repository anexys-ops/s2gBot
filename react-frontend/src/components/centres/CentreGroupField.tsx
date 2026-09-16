import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { labCentreGroupsApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

type Props = {
  value?: number | null
  onChange: (centreGroupId: number | undefined) => void
  disabled?: boolean
  required?: boolean
  label?: string
  hint?: string
  id?: string
}

/** Sélecteur de centre labo (LabCentreGroup), réutilisé sur dossier / devis / bon de commande. */
export default function CentreGroupField({
  value,
  onChange,
  disabled = false,
  required = false,
  label = 'Centre',
  hint,
  id = 'centre-group-field',
}: Props) {
  const { user } = useAuth()
  const { data: centres = [], isLoading } = useQuery({
    queryKey: ['lab-centre-groups'],
    queryFn: () => labCentreGroupsApi.list(),
    staleTime: 300_000,
  })

  const noCentreConfigured = !isLoading && centres.length === 0

  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        disabled={disabled || isLoading || noCentreConfigured}
        required={required}
      >
        <option value="">— Non défini —</option>
        {centres.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.name}
          </option>
        ))}
      </select>
      {isLoading ? (
        <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
          Chargement des centres…
        </p>
      ) : noCentreConfigured ? (
        <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
          Aucun centre configuré.
          {user?.role === 'lab_admin' ? (
            <>
              {' '}
              <Link to="/config/centres">Créer un centre</Link>
            </>
          ) : null}
        </p>
      ) : hint ? (
        <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
