import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { sitesApi, type Site } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export type SiteOutletContext = {
  siteId: number
  site: Site
  isAdmin: boolean
}

export default function SiteLayout() {
  const { siteId: siteIdParam } = useParams<{ siteId: string }>()
  const siteId = Number(siteIdParam)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'

  const { data: site, isLoading, error } = useQuery({
    queryKey: ['site', siteId],
    queryFn: () => sitesApi.get(siteId),
    enabled: Number.isFinite(siteId) && siteId > 0,
  })

  const deleteMut = useMutation({
    mutationFn: () => sitesApi.delete(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      navigate('/sites')
    },
  })

  if (!Number.isFinite(siteId) || siteId <= 0) {
    return <p className="error">Chantier invalide.</p>
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'CRM', to: '/crm' },
          { label: 'Chantiers', to: '/sites' },
          { label: '…' },
        ]}
        moduleBarLabel="Projets — Chantiers"
        title="Chargement…"
      >
        <p>Chargement…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !site) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'CRM', to: '/crm' },
          { label: 'Chantiers', to: '/sites' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Projets — Chantiers"
        title="Chantier introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Impossible de charger ce chantier.'}</p>
        <Link to="/sites" className="btn btn-secondary">
          Retour à la liste
        </Link>
      </ModuleEntityShell>
    )
  }

  const base = `/sites/${siteId}`
  const onNew = () => navigate('/sites', { state: { openCreate: true } })
  const onEdit = () => navigate(`${base}/fiche?edit=1`)
  const onDelete = () => {
    if (window.confirm(`Supprimer le chantier « ${site.name} » ?`)) {
      deleteMut.mutate()
    }
  }

  const ctx: SiteOutletContext = { siteId, site, isAdmin }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'CRM', to: '/crm' },
        { label: 'Chantiers', to: '/sites' },
        { label: site.name },
      ]}
      moduleBarLabel="Projets — Chantiers"
      title={site.name}
      subtitle={site.reference ? `Réf. ${site.reference} · #${site.id}` : `Réf. chantier #${site.id}`}
      tabs={[
        { to: `${base}/fiche`, label: 'Fiche chantier', end: true },
        { to: `${base}/missions`, label: 'Missions & forages' },
        { to: `${base}/carte`, label: 'Carte' },
      ]}
      actions={
        <>
          <Link to="/sites" className="btn btn-secondary btn-sm">
            Liste
          </Link>
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onNew}>
              Nouveau
            </button>
          )}
          {isAdmin && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
              Modifier
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              disabled={deleteMut.isPending}
              onClick={onDelete}
            >
              Supprimer
            </button>
          )}
        </>
      }
    >
      <Outlet context={ctx} />
    </ModuleEntityShell>
  )
}
