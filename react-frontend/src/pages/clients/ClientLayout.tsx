import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { clientsApi, type Client } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export type ClientOutletContext = {
  clientId: number
  client: Client
  isAdmin: boolean
  isLab: boolean
}

export default function ClientLayout() {
  const { clientId: clientIdParam } = useParams<{ clientId: string }>()
  const clientId = Number(clientIdParam)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
    enabled: Number.isFinite(clientId) && clientId > 0,
  })

  const deleteMut = useMutation({
    mutationFn: () => clientsApi.delete(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate('/clients')
    },
  })

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return <p className="error">Client invalide.</p>
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'CRM', to: '/crm' },
          { label: 'Clients', to: '/clients' },
          { label: '…' },
        ]}
        moduleBarLabel="Tiers — Clients"
        title="Chargement…"
      >
        <p>Chargement de la fiche…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !client) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'CRM', to: '/crm' },
          { label: 'Clients', to: '/clients' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Tiers — Clients"
        title="Client introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Impossible de charger ce client.'}</p>
        <Link to="/clients" className="btn btn-secondary">
          Retour à la liste
        </Link>
      </ModuleEntityShell>
    )
  }

  const base = `/clients/${clientId}`
  const tabs = [
    { to: `${base}/fiche`, label: 'Fiche', end: true as const },
    ...(isLab ? [{ to: `${base}/commerce`, label: 'Commerce & adresses' as const }] : []),
    ...(isLab ? [{ to: `${base}/documents`, label: 'Documents' as const }] : []),
  ]

  const onNew = () => navigate('/clients', { state: { openCreate: true } })

  const onEdit = () => navigate(`${base}/fiche?edit=1`)

  const onDelete = () => {
    if (window.confirm(`Supprimer définitivement le client « ${client.name} » ?`)) {
      deleteMut.mutate()
    }
  }

  const ctx: ClientOutletContext = { clientId, client, isAdmin, isLab }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'CRM', to: '/crm' },
        { label: 'Clients', to: '/clients' },
        { label: client.name },
      ]}
      moduleBarLabel="Tiers — Clients"
      title={client.name}
      subtitle={`Réf. client #${client.id}`}
      tabs={tabs}
      actions={
        <>
          <Link to="/clients" className="btn btn-secondary btn-sm">
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

export function LegacyClientCommercialRedirect() {
  const { clientId } = useParams<{ clientId: string }>()
  return <Navigate to={`/clients/${clientId}/commerce`} replace />
}
