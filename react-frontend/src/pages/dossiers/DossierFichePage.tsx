import { useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi, pdfApi, type DossierRow } from '../../api/client'
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
  const [pdfLoading, setPdfLoading] = useState(false)
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
          {dossier.centre_group ? (
            <span
              style={{
                background: 'var(--color-accent-soft, #e8f4fd)',
                color: 'var(--color-accent, #0a6bbf)',
                borderRadius: '0.3rem',
                padding: '0.1rem 0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {dossier.centre_group.name}
            </span>
          ) : null}
        </span>
      }
      actions={
        <button
          type="button"
          className="btn btn--outline btn--sm"
          disabled={pdfLoading}
          onClick={async () => {
            setPdfLoading(true)
            try {
              await pdfApi.generate('dossier', dossierId)
            } catch (e) {
              alert((e as Error).message ?? 'Erreur PDF')
            } finally {
              setPdfLoading(false)
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
        </button>
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
