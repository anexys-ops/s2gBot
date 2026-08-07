import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { dateInputFromApi } from '../../lib/appLocale'

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
  const { id } = useParams<{ id: string }>()
  const dossierId = id != null && id !== '' ? Number(id) : NaN
  const isEdit = Number.isFinite(dossierId) && dossierId > 0

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
  const [hydratedId, setHydratedId] = useState<number | null>(null)

  const {
    data: existing,
    isLoading: loadingExisting,
    error: loadError,
  } = useQuery({
    queryKey: ['dossier', dossierId],
    queryFn: () => dossiersApi.get(dossierId),
    enabled: isLab && isEdit,
  })

  useEffect(() => {
    if (!isEdit || !existing || hydratedId === existing.id) return
    setClientId(existing.client_id)
    setSiteId(existing.site_id)
    setMissionId(existing.mission_id ?? '')
    setTitre(existing.titre ?? '')
    setStatut(existing.statut)
    setDateDebut(dateInputFromApi(existing.date_debut) || new Date().toISOString().slice(0, 10))
    setDateFin(dateInputFromApi(existing.date_fin_prevue) || '')
    setMaitre(existing.maitre_ouvrage ?? '')
    setEntreprise(existing.entreprise_chantier ?? '')
    setNotes(existing.notes ?? '')
    setHydratedId(existing.id)
  }, [isEdit, existing, hydratedId])

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

  const saveMut = useMutation({
    mutationFn: (body: DossierCreateInput) =>
      isEdit ? dossiersApi.update(dossierId, body) : dossiersApi.create(body),
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ['dossiers'] })
      void queryClient.invalidateQueries({ queryKey: ['dossier', d.id] })
      navigate(`/dossiers/${d.id}/infos`)
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

  if (isEdit && loadingExisting) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Dossiers', to: '/dossiers' },
          { label: '…' },
        ]}
        moduleBarLabel="Dossiers chantier"
        title="Chargement…"
      >
        <p className="text-muted">Chargement du dossier…</p>
      </ModuleEntityShell>
    )
  }

  if (isEdit && (loadError || !existing)) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Dossiers', to: '/dossiers' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Dossiers chantier"
        title="Dossier introuvable"
      >
        <p className="error">{(loadError as Error)?.message ?? 'Accès refusé ou dossier supprimé.'}</p>
        <Link to="/dossiers" className="btn btn-secondary btn-sm">
          ← Liste
        </Link>
      </ModuleEntityShell>
    )
  }

  const cancelTo = isEdit ? `/dossiers/${dossierId}/infos` : '/dossiers'

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Dossiers', to: '/dossiers' },
        ...(isEdit
          ? [
              { label: existing!.reference, to: `/dossiers/${dossierId}/infos` },
              { label: 'Modifier' },
            ]
          : [{ label: 'Nouveau' }]),
      ]}
      moduleBarLabel="Dossiers chantier"
      title={isEdit ? `Modifier ${existing!.reference}` : 'Nouveau dossier'}
      subtitle={
        isEdit
          ? 'Mettez à jour les informations du dossier technique.'
          : 'Référence générée automatiquement (DOS-ANNEE-SEQUENCE).'
      }
      actions={
        <Link to={cancelTo} className="btn btn-secondary btn-sm">
          {isEdit ? '← Fiche' : '← Liste'}
        </Link>
      }
    >
      <div className="card dossier-new-form">
        <p className="dossier-new-form__intro">
          {isEdit ? (
            <>
              Référence : <code>{existing!.reference}</code>
            </>
          ) : (
            <>
              Rattachez le dossier à un <strong>client</strong> et un <strong>chantier</strong>, puis renseignez les
              informations du dossier technique.
            </>
          )}
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
            saveMut.mutate(body)
          }}
        >
          <section className="ds-form-section">
            <h2 className="ds-form-section__title">Contexte client & chantier</h2>
            <div className="dossier-new-form__grid">
              <div className="dossier-new-form__col-6">
                <ClientSelectField
                  label="Client"
                  clients={clients}
                  value={clientId === '' ? 0 : clientId}
                  onChange={(nextId) => {
                    setClientId(nextId)
                    setSiteId('')
                    setMissionId('')
                  }}
                  required
                />
              </div>
              <div className="dossier-new-form__col-6">
                <SiteSelectField
                  label="Chantier"
                  sites={sites}
                  value={siteId === '' ? 0 : siteId}
                  onChange={(nextId) => {
                    setSiteId(nextId)
                    setMissionId('')
                  }}
                  required
                  disabled={clientId === ''}
                  loading={clientId !== '' && sitesLoading}
                />
              </div>
              {clientId !== '' && !sitesLoading && sites.length === 0 ? (
                <p className="dossier-new-form__col-12 site-select-field__empty">
                  Ce client n&apos;a pas encore de chantier.{' '}
                  <Link to="/sites" state={{ openCreate: true }}>
                    Créer un chantier
                  </Link>
                </p>
              ) : null}
              <div className="dossier-new-form__col-6 form-group">
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
            </div>
          </section>

          <section className="ds-form-section">
            <h2 className="ds-form-section__title">Informations du dossier</h2>
            <div className="dossier-new-form__grid">
              <div className="dossier-new-form__col-8 form-group">
                <label htmlFor="dossier-titre">Titre *</label>
                <input
                  id="dossier-titre"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="ex. Étude géotechnique fondations"
                  required
                />
              </div>
              <div className="dossier-new-form__col-4 form-group">
                <label htmlFor="dossier-statut">Statut</label>
                <select id="dossier-statut" value={statut} onChange={(e) => setStatut(e.target.value as DossierStatut)}>
                  {STATUTS.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dossier-new-form__col-4 form-group">
                <label htmlFor="dossier-date-debut">Date de début *</label>
                <input
                  id="dossier-date-debut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  required
                />
              </div>
              <div className="dossier-new-form__col-4 form-group">
                <label htmlFor="dossier-date-fin">Fin prévue</label>
                <input id="dossier-date-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
              </div>
              <div className="dossier-new-form__col-4 form-group">
                <label htmlFor="dossier-maitre">Maître d&apos;ouvrage</label>
                <input id="dossier-maitre" value={maitre} onChange={(e) => setMaitre(e.target.value)} />
              </div>
              <div className="dossier-new-form__col-6 form-group">
                <label htmlFor="dossier-entreprise">Entreprise chantier</label>
                <input id="dossier-entreprise" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} />
              </div>
              <div className="dossier-new-form__col-12 form-group">
                <label htmlFor="dossier-notes">Notes</label>
                <textarea id="dossier-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </section>

          {saveMut.isError && <p className="error">{(saveMut.error as Error).message}</p>}

          <div className="dossier-new-form__actions">
            <button type="submit" className="btn btn-primary" disabled={saveMut.isPending || clientId === '' || siteId === ''}>
              {saveMut.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le dossier'}
            </button>
            <Link to={cancelTo} className="btn btn-secondary">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </ModuleEntityShell>
  )
}
