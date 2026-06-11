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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clientContactsApi, type ClientContactRow } from '../../api/client'

export function formatClientContactLabel(c: ClientContactRow): string {
  const name = [c.prenom, c.nom]
    .filter((s) => s != null && String(s).trim() !== '')
    .join(' ')
    .trim()
  const suffix = [
    c.poste?.trim() ? ` — ${c.poste.trim()}` : '',
    c.is_principal ? ' ★' : '',
    c.contact_type ? ` (${c.contact_type})` : '',
  ].join('')
  if (name) return `${name}${suffix}`
  if (c.email?.trim()) return `${c.email.trim()}${suffix}`
  if (c.telephone_mobile?.trim()) return `${c.telephone_mobile.trim()}${suffix}`
  if (c.telephone_direct?.trim()) return `${c.telephone_direct.trim()}${suffix}`
  return `Contact #${c.id}${suffix}`
}

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

  const typeFiltered = useMemo(
    () => (contactType ? contacts.filter((c) => c.contact_type === contactType) : contacts),
    [contacts, contactType],
  )

  const selectedContact = useMemo(
    () => (value ? contacts.find((c) => c.id === value) ?? null : null),
    [contacts, value],
  )

  const options = useMemo(() => {
    if (!contactType) return contacts
    if (typeFiltered.length > 0) {
      if (selectedContact && !typeFiltered.some((c) => c.id === selectedContact.id)) {
        return [selectedContact, ...typeFiltered]
      }
      return typeFiltered
    }
    return contacts
  }, [contactType, contacts, typeFiltered, selectedContact])

  const showTypeFallbackHint =
    Boolean(contactType) && typeFiltered.length === 0 && contacts.length > 0

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
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {formatClientContactLabel(c)}
          </option>
        ))}
      </select>
      {showTypeFallbackHint ? (
        <small className="text-muted" style={{ marginTop: '0.2rem', display: 'block' }}>
          Aucun contact « {contactType} » — liste complète des contacts client affichée.
        </small>
      ) : null}
      {selectedContact ? (
        <small style={{ color: 'var(--color-text-muted)', marginTop: '0.2rem', display: 'block' }}>
          {selectedContact.email ? <>{selectedContact.email}</> : null}
          {selectedContact.email && (selectedContact.telephone_mobile ?? selectedContact.telephone_direct)
            ? ' · '
            : null}
          {selectedContact.telephone_mobile ?? selectedContact.telephone_direct ?? ''}
        </small>
      ) : null}
    </div>
  )
}
