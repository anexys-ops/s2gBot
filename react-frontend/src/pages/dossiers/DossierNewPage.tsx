import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clientsApi,
  dossiersApi,
  missionsApi,
  sitesApi,
  type DossierCreateInput,
  type DossierStatut,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const STATUTS: { v: DossierStatut; l: string }[] = [
  { v: 'brouillon', l: 'Brouillon' },
  { v: 'en_cours', l: 'En cours' },
  { v: 'cloture', l: 'Clôturé' },
  { v: 'archive', l: 'Archivé' },
]

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

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
  })

  const { data: allSites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
    enabled: isLab && clientId !== '',
  })

  const sitesForClient = useMemo(() => {
    if (clientId === '') return []
    return (allSites ?? []).filter((s) => s.client_id === clientId)
  }, [allSites, clientId])

  const { data: missions } = useQuery({
    queryKey: ['missions-site', siteId],
    queryFn: () => missionsApi.list(siteId as number),
    enabled: isLab && siteId !== '',
  })

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
      <form
        className="form-stack"
        style={{ maxWidth: 520, display: 'grid', gap: '0.85rem' }}
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
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Client
          </span>
          <select
            className="form-control"
            required
            value={clientId === '' ? '' : String(clientId)}
            onChange={(e) => {
              setClientId(e.target.value === '' ? '' : Number(e.target.value))
              setSiteId('')
              setMissionId('')
            }}
          >
            <option value="">—</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Chantier (du client)
          </span>
          <select
            className="form-control"
            required
            value={siteId === '' ? '' : String(siteId)}
            onChange={(e) => {
              setSiteId(e.target.value === '' ? '' : Number(e.target.value))
              setMissionId('')
            }}
            disabled={clientId === ''}
          >
            <option value="">—</option>
            {sitesForClient.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Mission existante (optionnel)
          </span>
          <select
            className="form-control"
            value={missionId === '' ? '' : String(missionId)}
            onChange={(e) => setMissionId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={siteId === ''}
          >
            <option value="">— Aucune —</option>
            {(missions ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.reference} {m.title ? `— ${m.title}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Titre
          </span>
          <input className="form-control" required value={titre} onChange={(e) => setTitre(e.target.value)} />
        </label>
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Statut
          </span>
          <select
            className="form-control"
            value={statut}
            onChange={(e) => setStatut(e.target.value as DossierStatut)}
          >
            {STATUTS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 140px' }}>
            <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
              Date début
            </span>
            <input
              type="date"
              className="form-control"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </label>
          <label style={{ flex: '1 1 140px' }}>
            <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
              Fin prévue
            </span>
            <input type="date" className="form-control" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </label>
        </div>
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Maître d’ouvrage
          </span>
          <input className="form-control" value={maitre} onChange={(e) => setMaitre(e.target.value)} />
        </label>
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Entreprise chantier
          </span>
          <input className="form-control" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} />
        </label>
        <label>
          <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>
            Notes
          </span>
          <textarea className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
        <div>
          <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
            {createMut.isPending ? 'Enregistrement…' : 'Créer le dossier'}
          </button>
        </div>
      </form>
    </ModuleEntityShell>
  )
}
