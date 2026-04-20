import { useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import { canManageAppConfig } from '../../lib/settingsAccess'

type PageMeta = { title: string; subtitle: string; crumb: string }

function metaForPath(pathname: string): PageMeta {
  if (pathname.includes('/catalogue-essais'))
    return {
      title: 'Catalogue des essais',
      subtitle: 'Types d’essais, normes, tarifs unitaires et paramètres mesurés sur les dossiers.',
      crumb: 'Catalogue essais',
    }
  if (pathname.includes('/catalogue-commercial'))
    return {
      title: 'Catalogue commercial',
      subtitle: 'Produits et prestations : prix d’achat, prix de vente, TVA, stock — alimentation des lignes de devis.',
      crumb: 'Catalogue commercial',
    }
  if (pathname.includes('/granulometrie'))
    return {
      title: 'Granulométrie — indicateurs',
      subtitle: 'Interpolation log des tamis (D10, D30, D60) · Cu · Cc — usage courant NF EN ISO 17892-4.',
      crumb: 'Granulométrie',
    }
  if (pathname.includes('/cadrage'))
    return {
      title: 'Cadrage (Semaine 0)',
      subtitle: 'Périmètre LIMS BTP : flux de bout en bout à clarifier avant démarrage.',
      crumb: 'Cadrage (S0)',
    }
  if (pathname.includes('/exemples-calculs'))
    return {
      title: 'Calculs BTP',
      subtitle: 'Formules courantes et référentiels NF EN, DTU — calcul côté serveur.',
      crumb: 'Calculs BTP',
    }
  if (pathname.includes('/journal-audit'))
    return {
      title: 'Journal d’activité',
      subtitle: 'Piste d’audit simplifiée : missions, rapports (extensible).',
      crumb: 'Journal d’audit',
    }
  if (pathname.includes('/equipements'))
    return {
      title: 'Équipements & étalonnages',
      subtitle: 'Parc matériel, rattachement aux essais et suivi des échéances (SNIMA / ISO 17025).',
      crumb: 'Équipements',
    }
  if (pathname.includes('/modeles-rapports-pdf'))
    return {
      title: 'Modèles PDF — rapports d’essais',
      subtitle: 'Modèle par défaut utilisé lors de la génération depuis une commande.',
      crumb: 'Modèles PDF rapports',
    }
  if (pathname.includes('/modeles-documents-pdf'))
    return {
      title: 'Modèles PDF — devis & factures',
      subtitle: 'Modèle par défaut par type de document et mise en page (logo, signature, champs).',
      crumb: 'Modèles PDF documents',
    }
  if (pathname.includes('/pdf'))
    return {
      title: 'Création de PDF',
      subtitle: 'Devis, factures, rapports — filtrez la liste puis générez le document.',
      crumb: 'Création PDF',
    }
  if (pathname.includes('/mails'))
    return {
      title: 'Gestion des mails',
      subtitle: 'Envoi, modèles et historique des messages.',
      crumb: 'Mails',
    }
  if (pathname.includes('/configuration'))
    return {
      title: 'Configuration',
      subtitle: 'Champs personnalisés par module (extrafields) et valeurs des listes déroulantes (TVA, statuts…).',
      crumb: 'Configuration',
    }
  return {
    title: 'Back office',
    subtitle: 'Référentiels, outils de calcul et suivi — catalogues et configuration sont séparés.',
    crumb: 'Back office',
  }
}

function isBackOfficeCataloguePath(pathname: string): boolean {
  return (
    pathname.startsWith('/back-office/catalogue-essais') ||
    pathname.startsWith('/back-office/catalogue-commercial')
  )
}

export default function BackOfficeLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isAdmin = user?.role === 'lab_admin'
  const canAppConfig = canManageAppConfig(user)
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const onCatalogue = isBackOfficeCataloguePath(pathname)

  const meta = useMemo(() => metaForPath(pathname), [pathname])

  const catalogueTabs = [
    { to: '/back-office/catalogue-essais', label: 'Catalogue essais', end: true as const },
    { to: '/back-office/catalogue-commercial', label: 'Catalogue commercial', end: true as const },
  ]

  const toolsTabs = [
    { to: '/back-office/granulometrie', label: 'Granulométrie', end: true as const },
    { to: '/back-office/cadrage', label: 'Cadrage (S0)', end: true as const },
    { to: '/back-office/exemples-calculs', label: 'Calculs BTP', end: true as const },
    { to: '/back-office/journal-audit', label: 'Journal d’audit', end: true as const },
    { to: '/back-office/equipements', label: 'Équipements', end: true as const },
    { to: '/clients', label: 'Clients' },
    { to: '/sites', label: 'Chantiers' },
    ...(isLab
      ? [
          { to: '/back-office/pdf', label: 'Création PDF', end: true as const },
          { to: '/back-office/mails', label: 'Mails', end: true as const },
        ]
      : []),
    ...(isAdmin
      ? [
          { to: '/back-office/modeles-rapports-pdf', label: 'Modèles PDF rapports', end: true as const },
          { to: '/back-office/modeles-documents-pdf', label: 'Modèles PDF devis/factures', end: true as const },
        ]
      : []),
    ...(canAppConfig ? [{ to: '/back-office/configuration', label: 'Configuration', end: true as const }] : []),
  ]

  const tabs = onCatalogue ? catalogueTabs : toolsTabs

  const tabsAccessory = onCatalogue ? (
    <span className="back-office-tabs-accessory">
      <span className="back-office-tabs-accessory__label">Configuration et outils</span>
      <Link to="/back-office/granulometrie">Granulométrie, audit, clients, PDF, mails…</Link>
    </span>
  ) : (
    <span className="back-office-tabs-accessory">
      <span className="back-office-tabs-accessory__label">Catalogues</span>
      <Link to="/back-office/catalogue-essais">Catalogue essais</Link>
      <span className="back-office-tabs-accessory__sep" aria-hidden>
        ·
      </span>
      <Link to="/back-office/catalogue-commercial">Catalogue commercial</Link>
    </span>
  )

  return (
    <ModuleEntityShell
      shellClassName="module-shell--back-office"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Laboratoire', to: '/labo' },
        { label: meta.crumb },
      ]}
      moduleBarLabel={onCatalogue ? 'Laboratoire — Catalogues' : 'Laboratoire — Configuration et outils'}
      title={meta.title}
      subtitle={meta.subtitle}
      tabs={tabs}
      tabsAccessory={tabsAccessory}
    >
      <Outlet />
    </ModuleEntityShell>
  )
}
