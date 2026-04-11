import { useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'

type PageMeta = { title: string; subtitle: string; crumb: string }

function metaForPath(pathname: string): PageMeta {
  if (pathname.includes('/catalogue-essais'))
    return {
      title: 'Catalogue des essais',
      subtitle: 'Types d’essais, normes, tarifs unitaires et paramètres mesurés sur les dossiers.',
      crumb: 'Catalogue essais',
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
  if (pathname.includes('/modeles-rapports-pdf'))
    return {
      title: 'Modèles PDF — rapports d’essais',
      subtitle: 'Modèle par défaut utilisé lors de la génération depuis une commande.',
      crumb: 'Modèles PDF rapports',
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
    subtitle: 'Référentiels, outils de calcul et suivi — navigation par onglets.',
    crumb: 'Back office',
  }
}

export default function BackOfficeLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isAdmin = user?.role === 'lab_admin'
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const meta = useMemo(() => metaForPath(pathname), [pathname])

  const tabs = [
    { to: '/back-office/catalogue-essais', label: 'Catalogue essais', end: true as const },
    { to: '/back-office/granulometrie', label: 'Granulométrie', end: true as const },
    { to: '/back-office/cadrage', label: 'Cadrage (S0)', end: true as const },
    { to: '/back-office/exemples-calculs', label: 'Calculs BTP', end: true as const },
    { to: '/back-office/journal-audit', label: 'Journal d’audit', end: true as const },
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
          { to: '/back-office/configuration', label: 'Configuration', end: true as const },
        ]
      : []),
  ]

  return (
    <ModuleEntityShell
      shellClassName="module-shell--back-office"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Terrain & labo', to: '/terrain' },
        { label: meta.crumb },
      ]}
      moduleBarLabel="Laboratoire — Back office"
      title={meta.title}
      subtitle={meta.subtitle}
      tabs={tabs}
    >
      <Outlet />
    </ModuleEntityShell>
  )
}
