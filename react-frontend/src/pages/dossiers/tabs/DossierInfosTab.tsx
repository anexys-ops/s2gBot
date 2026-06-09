import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dossiersApi } from '../../../api/client'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import ClientContactPicker from '../../../components/clients/ClientContactPicker'
import { useAuth } from '../../../contexts/AuthContext'
import StatusBadge, { dossierStatutBadgeProps } from '../../../components/ds/StatusBadge'

function formatDateFr(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : d.toLocaleDateString('fr-FR')
}

export default function DossierInfosTab() {
  const { dossier, dossierId } = useOutletContext<DossierFicheOutletContext>()
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const qc = useQueryClient()
  const st = dossierStatutBadgeProps(dossier.statut)

  const [contactId, setContactId] = useState<number | null>(dossier.contact_id ?? null)

  const mutContact = useMutation({
    mutationFn: (id: number | null) => dossiersApi.update(dossierId, { contact_id: id }),
    onSuccess: (updated) => {
      qc.setQueryData(['dossier', dossierId], updated)
      void qc.invalidateQueries({ queryKey: ['dossiers'] })
    },
  })

  return (
    <div className="dossier-infos-tab">
      <div className="card dossier-infos-panel">
        <section className="ds-form-section">
          <h2 className="ds-form-section__title">Identité du dossier</h2>
          <dl className="dossier-infos-grid">
            <div className="dossier-infos-grid__col-4">
              <dt>Référence</dt>
              <dd>
                <code>{dossier.reference}</code>
              </dd>
            </div>
            <div className="dossier-infos-grid__col-4">
              <dt>Statut</dt>
              <dd>
                <StatusBadge variant={st.variant} size="md">
                  {st.label}
                </StatusBadge>
              </dd>
            </div>
            <div className="dossier-infos-grid__col-4">
              <dt>Créé par</dt>
              <dd>{dossier.createur?.name ?? '—'}</dd>
            </div>
            <div className="dossier-infos-grid__col-12">
              <dt>Titre</dt>
              <dd>{dossier.titre}</dd>
            </div>
          </dl>
        </section>

        <section className="ds-form-section">
          <h2 className="ds-form-section__title">Contexte client & chantier</h2>
          <dl className="dossier-infos-grid">
            <div className="dossier-infos-grid__col-6">
              <dt>Client</dt>
              <dd>
                {dossier.client?.id ? (
                  <Link to={`/clients/${dossier.client.id}/fiche`}>{dossier.client.name}</Link>
                ) : (
                  (dossier.client?.name ?? '—')
                )}
              </dd>
            </div>
            <div className="dossier-infos-grid__col-6">
              <dt>Chantier</dt>
              <dd>
                {dossier.site?.id ? (
                  <Link to={`/sites/${dossier.site.id}/fiche`}>{dossier.site.name}</Link>
                ) : (
                  (dossier.site?.name ?? '—')
                )}
              </dd>
            </div>
            <div className="dossier-infos-grid__col-6">
              <dt>Mission liée</dt>
              <dd>
                {dossier.mission
                  ? `${dossier.mission.reference}${dossier.mission.title ? ` — ${dossier.mission.title}` : ''}`
                  : '—'}
              </dd>
            </div>
            <div className="dossier-infos-grid__col-6">
              <dt>Contact technique client</dt>
              <dd>
                {dossier.clientContact
                  ? `${dossier.clientContact.prenom} ${dossier.clientContact.nom}${
                      dossier.clientContact.poste ? ` — ${dossier.clientContact.poste}` : ''
                    }`
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="ds-form-section">
          <h2 className="ds-form-section__title">Calendrier & intervenants</h2>
          <dl className="dossier-infos-grid">
            <div className="dossier-infos-grid__col-4">
              <dt>Date de début</dt>
              <dd>{formatDateFr(dossier.date_debut)}</dd>
            </div>
            <div className="dossier-infos-grid__col-4">
              <dt>Fin prévue</dt>
              <dd>{formatDateFr(dossier.date_fin_prevue)}</dd>
            </div>
            <div className="dossier-infos-grid__col-4">
              <dt>Maître d&apos;ouvrage</dt>
              <dd>{dossier.maitre_ouvrage?.trim() ? dossier.maitre_ouvrage : '—'}</dd>
            </div>
            <div className="dossier-infos-grid__col-6">
              <dt>Entreprise chantier</dt>
              <dd>{dossier.entreprise_chantier?.trim() ? dossier.entreprise_chantier : '—'}</dd>
            </div>
            {dossier.notes?.trim() ? (
              <div className="dossier-infos-grid__col-12">
                <dt>Notes</dt>
                <dd className="dossier-infos-notes">{dossier.notes}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      {isAdmin && (
        <div className="card dossier-infos-panel">
          <section className="ds-form-section" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <h2 className="ds-form-section__title">Contact technique client</h2>
            <div className="dossier-infos-grid">
              <div className="dossier-infos-grid__col-6">
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
              </div>
            </div>
            {mutContact.isError && <p className="error">{(mutContact.error as Error).message}</p>}
          </section>
        </div>
      )}

      {dossier.contacts && dossier.contacts.length > 0 && (
        <div className="card dossier-infos-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem 0.5rem' }}>
            <h2 className="ds-form-section__title" style={{ margin: 0 }}>
              Contacts chantier
            </h2>
          </div>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Rôle</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                </tr>
              </thead>
              <tbody>
                {dossier.contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {c.prenom ? `${c.prenom} ` : ''}
                        {c.nom}
                      </strong>
                    </td>
                    <td>{c.role?.trim() ? c.role : '—'}</td>
                    <td>{c.email?.trim() ? c.email : '—'}</td>
                    <td>{c.telephone?.trim() ? c.telephone : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
