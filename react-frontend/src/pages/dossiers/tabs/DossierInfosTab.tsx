import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import ClientContactPicker from '../../../components/clients/ClientContactPicker'
import { useAuth } from '../../../contexts/AuthContext'

export default function DossierInfosTab() {
  const { dossier, dossierId } = useOutletContext<DossierFicheOutletContext>()
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const qc = useQueryClient()

  const [contactId, setContactId] = useState<number | null>(dossier.contact_id ?? null)

  const mutContact = useMutation({
    mutationFn: (id: number | null) => dossiersApi.update(dossierId, { contact_id: id }),
    onSuccess: (updated) => {
      qc.setQueryData(['dossier', dossierId], updated)
      void qc.invalidateQueries({ queryKey: ['dossiers'] })
    },
  })

  return (
    <div className="dossier-fiche-tab">
      <div className="entity-meta-grid" style={{ display: 'grid', gap: '0.75rem', maxWidth: 720 }}>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Référence</span>
          <div><code>{dossier.reference}</code></div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Statut</span>
          <div>{dossier.statut}</div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Période</span>
          <div>
            {dossier.date_debut?.slice(0, 10)}
            {dossier.date_fin_prevue ? ` → ${dossier.date_fin_prevue.slice(0, 10)}` : ''}
          </div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Client</span>
          <div>{dossier.client?.name ?? '—'}</div>
        </div>
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Chantier</span>
          <div>{dossier.site?.name ?? '—'}</div>
        </div>
        {/* Contact technique S2G */}
        <div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Contact technique client</span>
          <div>
            {dossier.clientContact
              ? `${dossier.clientContact.prenom} ${dossier.clientContact.nom}${dossier.clientContact.poste ? ` — ${dossier.clientContact.poste}` : ''}`
              : '—'}
          </div>
        </div>
        {dossier.maitre_ouvrage && (
          <div>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Maître d'ouvrage</span>
            <div>{dossier.maitre_ouvrage}</div>
          </div>
        )}
        {dossier.entreprise_chantier && (
          <div>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Entreprise chantier</span>
            <div>{dossier.entreprise_chantier}</div>
          </div>
        )}
        {dossier.notes && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Notes</span>
            <div style={{ whiteSpace: 'pre-wrap' }}>{dossier.notes}</div>
          </div>
        )}
      </div>

      {/* Picker contact technique — admin seulement */}
      {isAdmin && (
        <div className="card" style={{ marginTop: '1.25rem', maxWidth: 480 }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 600 }}>
            Contact technique client
          </h3>
          <ClientContactPicker
            clientId={dossier.client_id}
            value={contactId}
            onChange={(id) => {
              setContactId(id)
              mutContact.mutate(id)
            }}
            label="Contact technique"
            contactType="technique"
          />
          {mutContact.isError && (
            <p className="error" style={{ fontSize: '0.85rem' }}>
              {(mutContact.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Contacts chantier (dossier_contacts, existants) */}
      {dossier.contacts && dossier.contacts.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 className="h2" style={{ fontSize: '1rem' }}>Contacts chantier</h3>
          <ul className="dossier-contacts-list" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
            {dossier.contacts.map((c) => (
              <li
                key={c.id}
                style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}
              >
                <strong>
                  {c.prenom ? `${c.prenom} ` : ''}
                  {c.nom}
                </strong>
                {c.role && <span className="text-muted"> — {c.role}</span>}
                <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                  {[c.email, c.telephone].filter(Boolean).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
