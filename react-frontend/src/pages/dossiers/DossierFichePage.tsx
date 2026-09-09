import { Outlet, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi, type DossierRow } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import StatusBadge, { dossierStatutBadgeProps } from '../../components/ds/StatusBadge'

const TABS = [
  { to: 'infos', label: 'Infos' },
  { to: 'devis', label: 'Devis' },
  { to: 'bc-bl', label: 'BC / BL' },
  { to: 'essais', label: 'Essais' },
  { to: 'documents', label: 'Documents' },
  { to: 'extrafields', label: 'Champs personnalisés' },
] as const

export default function DossierFichePage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const isPortal = location.pathname.startsWith('/portal/dossiers')
  const dossierId = Number(id)
  const listPath = isPortal ? '/portal/dossiers' : '/dossiers'
  const homePath = isPortal ? '/portal' : '/'
  const { data: dossier, isLoading, error } = useQuery({
    queryKey: ['dossier', dossierId],
    queryFn: () => dossiersApi.get(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  })

  if (!Number.isFinite(dossierId) || dossierId <= 0) {
    return <p className="error">Identifiant invalide.</p>
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: isPortal ? 'Portail' : 'Accueil', to: homePath },
          { label: 'Dossiers', to: listPath },
          { label: '…' },
        ]}
        moduleBarLabel={isPortal ? 'Portail — Dossier' : 'Dossier chantier'}
        title="Chargement…"
      >
        <p className="text-muted">Chargement de la fiche…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !dossier) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: isPortal ? 'Portail' : 'Accueil', to: homePath },
          { label: 'Dossiers', to: listPath },
          { label: 'Erreur' },
        ]}
        moduleBarLabel={isPortal ? 'Portail — Dossier' : 'Dossier chantier'}
        title="Dossier introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Accès refusé ou dossier supprimé.'}</p>
      </ModuleEntityShell>
    )
  }

  const base = `${listPath}/${dossierId}`
  const visibleTabs = isPortal ? TABS.filter((t) => t.to === 'infos' || t.to === 'documents') : TABS
  const st = dossierStatutBadgeProps(dossier.statut)

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: isPortal ? 'Portail' : 'Accueil', to: homePath },
        { label: 'Dossiers', to: listPath },
        { label: dossier.reference },
      ]}
      moduleBarLabel={isPortal ? 'Portail — Dossier' : 'Dossier chantier'}
      title={dossier.titre}
      subtitle={
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <code>{dossier.reference}</code>
          <StatusBadge variant={st.variant} size="lg">
            {st.label}
          </StatusBadge>
          <span>
            {dossier.client?.name ?? ''} — {dossier.site?.name ?? ''}
          </span>
        </span>
      }
      tabs={visibleTabs.map((t) => ({ to: `${base}/${t.to}`, label: t.label, end: true }))}
    >
      <Outlet context={{ dossier, dossierId } satisfies DossierFicheOutletContext} />
    </ModuleEntityShell>
  )
}

export type DossierFicheOutletContext = {
  dossier: DossierRow
  dossierId: number
}
