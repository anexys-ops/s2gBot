import { Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi, type DossierRow } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const STATUT_BADGE: Record<string, string> = {
  brouillon: 'dossier-badge dossier-badge--brouillon',
  en_cours: 'dossier-badge dossier-badge--cours',
  cloture: 'dossier-badge dossier-badge--cloture',
  archive: 'dossier-badge dossier-badge--archive',
}

const TABS = [
  { to: 'infos', label: 'Infos' },
  { to: 'devis', label: 'Devis' },
  { to: 'bc-bl', label: 'BC / BL' },
  { to: 'essais', label: 'Essais' },
  { to: 'documents', label: 'Documents' },
] as const

export default function DossierFichePage() {
  const { id } = useParams<{ id: string }>()
  const dossierId = Number(id)
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
          { label: 'Accueil', to: '/' },
          { label: 'Dossiers', to: '/dossiers' },
          { label: '…' },
        ]}
        moduleBarLabel="Dossier chantier"
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
          { label: 'Accueil', to: '/' },
          { label: 'Dossiers', to: '/dossiers' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Dossier chantier"
        title="Dossier introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Accès refusé ou dossier supprimé.'}</p>
      </ModuleEntityShell>
    )
  }

  const base = `/dossiers/${dossierId}`

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Dossiers', to: '/dossiers' },
        { label: dossier.reference },
      ]}
      moduleBarLabel="Dossier chantier"
      title={dossier.titre}
      subtitle={
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <code>{dossier.reference}</code>
          <span className={STATUT_BADGE[dossier.statut] ?? 'dossier-badge'}>{dossier.statut}</span>
          <span>
            {dossier.client?.name ?? ''} — {dossier.site?.name ?? ''}
          </span>
        </span>
      }
      tabs={TABS.map((t) => ({ to: `${base}/${t.to}`, label: t.label, end: true }))}
    >
      <Outlet context={{ dossier, dossierId } satisfies DossierFicheOutletContext} />
    </ModuleEntityShell>
  )
}

export type DossierFicheOutletContext = {
  dossier: DossierRow
  dossierId: number
}
