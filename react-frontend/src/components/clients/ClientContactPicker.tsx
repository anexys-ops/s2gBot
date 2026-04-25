/**
 * ClientContactPicker
 *
 * Select déroulant pour choisir un contact parmi la liste d'un client.
 * Utilisé sur : Devis, BonCommande, BonLivraison, Facture, Dossier.
 *
 * Props:
 *  clientId     : id du client (pour charger ses contacts)
 *  value        : contact_id sélectionné (null = aucun)
 *  onChange     : callback quand la valeur change
 *  label        : libellé du champ (défaut "Contact client")
 *  contactType  : filtre optionnel sur contact_type ('commercial'|'facturation'|'technique'|…)
 *  disabled     : désactiver le select
 */
import { useQuery } from '@tanstack/react-query'
import { clientContactsApi, type ClientContactRow } from '../../api/client'

interface Props {
  clientId: number | null | undefined
  value: number | null | undefined
  onChange: (id: number | null, contact?: ClientContactRow | null) => void
  label?: string
  contactType?: string
  disabled?: boolean
  required?: boolean
}

export default function ClientContactPicker({
  clientId,
  value,
  onChange,
  label = 'Contact client',
  contactType,
  disabled = false,
  required = false,
}: Props) {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: () => clientContactsApi.list(clientId!),
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  })

  const filtered = contactType ? contacts.filter((c) => c.contact_type === contactType) : contacts

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value ? Number(e.target.value) : null
    const contact = id ? contacts.find((c) => c.id === id) ?? null : null
    onChange(id, contact)
  }

  if (!clientId) {
    return (
      <div className="form-group">
        <label>{label}</label>
        <select disabled>
          <option>— Sélectionner un client d'abord —</option>
        </select>
      </div>
    )
  }

  return (
    <div className="form-group">
      <label>
        {label}
        {required && ' *'}
      </label>
      <select
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled || isLoading}
        required={required}
      >
        <option value="">— Aucun contact —</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.prenom} {c.nom}
            {c.poste ? ` — ${c.poste}` : ''}
            {c.is_principal ? ' ★' : ''}
            {c.contact_type && !contactType ? ` (${c.contact_type})` : ''}
          </option>
        ))}
      </select>
      {value && (() => {
        const c = contacts.find((x) => x.id === value)
        if (!c) return null
        return (
          <small style={{ color: 'var(--color-text-muted)', marginTop: '0.2rem', display: 'block' }}>
            {c.email && <>{c.email} · </>}
            {c.telephone_mobile ?? c.telephone_direct ?? ''}
          </small>
        )
      })()}
    </div>
  )
}
