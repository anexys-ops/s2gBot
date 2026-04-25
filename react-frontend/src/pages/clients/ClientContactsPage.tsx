import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clientContactsApi } from '../../api/client'
import ListTableToolbar from '../../components/ListTableToolbar'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

function contactName(prenom?: string | null, nom?: string | null) {
  return [prenom, nom].filter(Boolean).join(' ').trim() || 'Contact sans nom'
}

function contactPhone(direct?: string | null, mobile?: string | null) {
  return [direct, mobile].filter(Boolean).join(' / ') || '—'
}

export default function ClientContactsPage() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['client-contacts', 'all', debouncedSearch],
    queryFn: () => clientContactsApi.listAll({ search: debouncedSearch.trim() || undefined }),
  })

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Clients', to: '/clients' },
        { label: 'Contacts' },
      ]}
      moduleBarLabel="Tiers — Contacts"
      title="Contacts"
      subtitle={`${contacts.length} contact(s) client affiché(s)`}
    >
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Nom, email, téléphone, poste ou client…"
      />

      {isLoading && <p>Chargement des contacts…</p>}
      {error && <p className="error">Erreur : {(error as Error).message}</p>}

      {!isLoading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Client</th>
                  <th>Poste / service</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Principal</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contactName(contact.prenom, contact.nom)}</td>
                    <td>
                      <Link to={`/clients/${contact.client_id}/fiche`} className="link-inline">
                        {contact.client?.name ?? `Client #${contact.client_id}`}
                      </Link>
                    </td>
                    <td>{[contact.poste, contact.departement].filter(Boolean).join(' — ') || '—'}</td>
                    <td>
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="link-inline">
                          {contact.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{contactPhone(contact.telephone_direct, contact.telephone_mobile)}</td>
                    <td>{contact.is_principal ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {contacts.length === 0 && <p style={{ padding: '1rem' }}>Aucun contact client.</p>}
        </div>
      )}
    </ModuleEntityShell>
  )
}
