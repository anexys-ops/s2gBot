import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clientsApi,
  dossiersApi,
  missionsApi,
  sitesApi,
  type Client,
  type DossierCreateInput,
  type DossierStatut,
  type Mission,
  type Site,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import ClientSelectField from '../../components/clients/ClientSelectField'
import SiteSelectField from '../../components/sites/SiteSelectField'

const STATUTS: { v: DossierStatut; l: string }[] = [
  { v: 'brouillon', l: 'Brouillon' },
  { v: 'en_cours', l: 'En cours' },
  { v: 'cloture', l: 'Clôturé' },
  { v: 'archive', l: 'Archivé' },
]

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
    return (data as { data: T[] }).data
  }
  return []
}

export default function DossierNewPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [clientId, setClientId] = useState<number | ''>('')
  const [siteId, setSiteId] = useState<number | ''>('')
  const [missionId, setMissionId] = useState<number | ''>('')
  const [titre, setTitre] = useState('')
  const [statut, setStatut] = useState<DossierStatut>('brouillon')
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateFin, setDateFin] = useState('')
  const [maitre, setMaitre] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [notes, setNotes] = useState('')

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'select-options'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
    staleTime: 60_000,
  })

  const clients = normalizeList<Client>(clientsData)

  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ['sites', 'by-client', clientId],
    queryFn: () => sitesApi.list({ client_id: clientId as number }),
    enabled: isLab && clientId !== '',
  })

  const sites = normalizeList<Site>(sitesData)

  const { data: missionsData, isLoading: missionsLoading } = useQuery({
    queryKey: ['missions-site', siteId],
    queryFn: () => missionsApi.list(siteId as number),
    enabled: isLab && siteId !== '',
  })

  const missions = normalizeList<Mission>(missionsData)

  const createMut = useMutation({
    mutationFn: (body: DossierCreateInput) => dossiersApi.create(body),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['dossiers'] })
      navigate(`/dossiers/${d.id}`)
    },
  })

  if (!isLab) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Dossiers', to: '/dossiers' },
        ]}
        moduleBarLabel="Dossiers"
        title="Accès refusé"
      >
        <p className="error">Réservé au laboratoire.</p>
        <Link to="/dossiers">Retour</Link>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Dossiers', to: '/dossiers' },
        { label: 'Nouveau' },
      ]}
      moduleBarLabel="Dossiers chantier"
      title="Nouveau dossier"
      subtitle="Référence générée automatiquement (DOS-ANNEE-SEQUENCE)."
      actions={
        <Link to="/dossiers" className="btn btn-secondary btn-sm">
          ← Liste
        </Link>
      }
    >
      <div className="card dossier-new-form" style={{ padding: '1.25rem 1.35rem' }}>
        <p className="dossier-new-form__intro">
          Rattachez le dossier à un <strong>client</strong> et un <strong>chantier</strong>, puis renseignez les informations
          du dossier technique.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (clientId === '' || siteId === '' || !titre.trim()) return
            const body: DossierCreateInput = {
              titre: titre.trim(),
              client_id: clientId,
              site_id: siteId,
              statut,
              date_debut: dateDebut,
              maitre_ouvrage: maitre.trim() || null,
              entreprise_chantier: entreprise.trim() || null,
              notes: notes.trim() || null,
              date_fin_prevue: dateFin || null,
              mission_id: missionId === '' ? null : missionId,
            }
            createMut.mutate(body)
          }}
        >
          <section className="ds-form-section">
            <h2 className="ds-form-section__title">Contexte client & chantier</h2>
            <ClientSelectField
              label="Client"
              clients={clients}
              value={clientId === '' ? 0 : clientId}
              onChange={(id) => {
                setClientId(id)
                setSiteId('')
                setMissionId('')
              }}
              required
            />
            <SiteSelectField
              label="Chantier"
              sites={sites}
              value={siteId === '' ? 0 : siteId}
              onChange={(id) => {
                setSiteId(id)
                setMissionId('')
              }}
              required
              disabled={clientId === ''}
              loading={clientId !== '' && sitesLoading}
            />
            {clientId !== '' && !sitesLoading && sites.length === 0 ? (
              <p className="site-select-field__empty" style={{ marginTop: '-0.35rem' }}>
                Ce client n&apos;a pas encore de chantier.{' '}
                <Link to="/sites" state={{ openCreate: true }}>
                  Créer un chantier
                </Link>
              </p>
            ) : null}
            <div className="form-group">
              <label htmlFor="dossier-mission">Mission existante (optionnel)</label>
              <select
                id="dossier-mission"
                value={missionId === '' ? '' : String(missionId)}
                onChange={(e) => setMissionId(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={siteId === '' || missionsLoading}
              >
                <option value="">— Aucune —</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.reference}
                    {m.title ? ` — ${m.title}` : ''}
                  </option>
                ))}
              </select>
              {siteId !== '' && missionsLoading ? (
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
                  Chargement des missions…
                </p>
              ) : null}
            </div>
          </section>

          <section className="ds-form-section">
            <h2 className="ds-form-section__title">Identité du dossier</h2>
            <div className="form-group">
              <label htmlFor="dossier-titre">Titre *</label>
              <input
                id="dossier-titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="ex. Étude géotechnique fondations"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="dossier-statut">Statut</label>
              <select id="dossier-statut" value={statut} onChange={(e) => setStatut(e.target.value as DossierStatut)}>
                {STATUTS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.l}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="ds-form-section">
            <h2 className="ds-form-section__title">Calendrier</h2>
            <div className="dossier-new-form__grid-2">
              <div className="form-group">
                <label htmlFor="dossier-date-debut">Date de début *</label>
                <input
                  id="dossier-date-debut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="dossier-date-fin">Fin prévue</label>
                <input id="dossier-date-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="ds-form-section">
            <h2 className="ds-form-section__title">Intervenants & notes</h2>
            <div className="form-group">
              <label htmlFor="dossier-maitre">Maître d&apos;ouvrage</label>
              <input id="dossier-maitre" value={maitre} onChange={(e) => setMaitre(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="dossier-entreprise">Entreprise chantier</label>
              <input id="dossier-entreprise" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="dossier-notes">Notes</label>
              <textarea id="dossier-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>

          {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}

          <div className="dossier-new-form__actions">
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending || clientId === '' || siteId === ''}>
              {createMut.isPending ? 'Enregistrement…' : 'Créer le dossier'}
            </button>
            <Link to="/dossiers" className="btn btn-secondary">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </ModuleEntityShell>
  )
}
