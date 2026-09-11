import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { brandingApi } from '../api/client'
import { DEFAULT_APP_LOGO_ALT, DEFAULT_APP_LOGO_SRC, resolveAppLogoSrc } from '../lib/appBranding'
import GlobalSearch from './GlobalSearch'
import { isPortalUser } from '../lib/portalAccess'
import {
  canAccessOrdresMission,
  canAccessStaffModule,
  hasStaffCapability,
  type StaffModuleKey,
} from '../lib/staffAccess'
import { canManageAppConfig, canManageGroups, canManageUsers } from '../lib/settingsAccess'

type SubItem = {
  to: string
  label: string
  module?: StaffModuleKey
  permission?: string
}

type MenuGroupId =
  | 'commercial'
  | 'terrain'
  | 'laboratoire'
  | 'ingenierie'
  | 'catalogue'
  | 'configuration'
  | 'rapports'

type MenuGroup = {
  id: MenuGroupId
  label: string
  module: StaffModuleKey
  items: SubItem[]
}

function isCommercialActive(pathname: string): boolean {
  if (pathname === '/clients' || pathname.startsWith('/clients/')) return true
  if (pathname === '/sites' || pathname.startsWith('/sites/')) return true
  if (pathname.startsWith('/devis')) return true
  if (pathname.startsWith('/bons-commande')) return true
  if (pathname.startsWith('/bons-livraison')) return true
  if (pathname.startsWith('/factures')) return true
  if (pathname.startsWith('/invoices')) return true
  return false
}

function isTerrainActive(pathname: string): boolean {
  if (pathname.startsWith('/terrain')) return true
  if (pathname.startsWith('/ordres-mission')) return true
  if (pathname.startsWith('/notes-de-frais')) return true
  return false
}

function isLaboratoireActive(pathname: string): boolean {
  if (pathname.startsWith('/labo')) return true
  return false
}

function isIngenerieActive(pathname: string): boolean {
  if (pathname.startsWith('/ingenierie')) return true
  return false
}

function isCatalogueActive(pathname: string): boolean {
  if (pathname === '/catalogue' || pathname.startsWith('/catalogue/')) return true
  if (pathname.startsWith('/materiel')) return true
  return false
}

function isConfigurationActive(pathname: string): boolean {
  if (pathname.startsWith('/config/agences')) return true
  if (pathname.startsWith('/settings/utilisateurs')) return true
  if (pathname.startsWith('/settings/groupes')) return true
  if (pathname.startsWith('/back-office/modeles-documents-pdf')) return true
  if (pathname.startsWith('/back-office/configuration')) return true
  return false
}

function isReportsActive(pathname: string): boolean {
  return pathname.startsWith('/rapports')
}

function isGroupActive(id: MenuGroupId, pathname: string): boolean {
  switch (id) {
    case 'commercial':
      return isCommercialActive(pathname) || pathname.startsWith('/dossiers')
    case 'terrain':
      return isTerrainActive(pathname)
    case 'laboratoire':
      return isLaboratoireActive(pathname)
    case 'ingenierie':
      return isIngenerieActive(pathname)
    case 'catalogue':
      return isCatalogueActive(pathname)
    case 'configuration':
      return isConfigurationActive(pathname)
    case 'rapports':
      return isReportsActive(pathname)
    default:
      return false
  }
}

export default function AppNavigation() {
  const { user, logout } = useAuth()
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => brandingApi.get(),
    enabled: Boolean(user),
    staleTime: 120_000,
    placeholderData: (previous) => previous,
  })
  const brandLogoSrc = resolveAppLogoSrc(branding)
  const [logoSrc, setLogoSrc] = useState(brandLogoSrc)

  useEffect(() => {
    setLogoSrc(brandLogoSrc)
  }, [brandLogoSrc])
  const location = useLocation()
  const pathname = location.pathname
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const groups: MenuGroup[] = useMemo(() => {
    const canCommercial = canAccessStaffModule(user, 'commercial')
    const canDossiers = canAccessStaffModule(user, 'dossiers')
    const canOdm = canAccessOrdresMission(user)

    const filterItems = (items: SubItem[]) =>
      items.filter((item) => {
        if (item.permission && !hasStaffCapability(user, item.permission)) return false
        if (item.module && !canAccessStaffModule(user, item.module)) return false
        return true
      })

    const allGroups: MenuGroup[] = [
      {
        id: 'commercial',
        label: 'Commercial',
        module: 'commercial',
        items: filterItems([
          { to: '/clients', label: 'Clients', module: 'commercial' },
          { to: '/sites', label: 'Chantiers', module: 'commercial' },
          { to: '/dossiers', label: 'Dossiers', module: 'dossiers' },
          { to: '/devis', label: 'Devis', module: 'commercial' },
          { to: '/bons-commande', label: 'Bons de commande', module: 'commercial' },
          { to: '/bons-livraison', label: 'Bons de livraison', module: 'commercial' },
          { to: '/factures', label: 'Factures', module: 'commercial' },
        ]),
      },
      {
        id: 'terrain',
        label: 'Terrain',
        module: 'terrain',
        items: filterItems([
          { to: '/terrain/chantiers', label: 'Chantiers et carte GPS', module: 'terrain' },
          { to: '/terrain/mesures', label: 'Mesures terrain', module: 'terrain' },
          ...(canOdm
            ? [{ to: '/ordres-mission?context=terrain&type=technicien', label: 'Ordres de mission', module: 'terrain' as StaffModuleKey }]
            : []),
          { to: '/terrain/taches', label: 'Tâches terrain', module: 'terrain' },
          { to: '/terrain/planning', label: 'Planning terrain', module: 'terrain' },
          { to: '/notes-de-frais', label: 'Notes de frais', module: 'terrain' },
        ]),
      },
      {
        id: 'laboratoire',
        label: 'Laboratoire',
        module: 'laboratoire',
        items: filterItems([
          { to: '/labo/reception', label: 'Réception (FOLD)', module: 'laboratoire' },
          ...(canOdm
            ? [{ to: '/ordres-mission?context=labo&type=labo', label: 'Ordres de mission', module: 'laboratoire' as StaffModuleKey }]
            : []),
          { to: '/labo/taches', label: 'Tâches en cours', module: 'laboratoire' },
          { to: '/labo/planning', label: 'Planning labo', module: 'laboratoire' },
          { to: '/labo/rapports', label: "Rapports d'essais", module: 'laboratoire' },
          { to: '/labo/fiches', label: 'Fiches techniques', module: 'laboratoire' },
          { to: '/labo/transco', label: 'Transco FOLD', module: 'laboratoire', permission: 'config.manage' },
        ]),
      },
      {
        id: 'ingenierie',
        label: 'Ingénierie',
        module: 'ingenierie',
        items: filterItems([
          ...(canOdm
            ? [{ to: '/ordres-mission?context=ingenierie&type=ingenieur', label: 'Ordres de mission', module: 'ingenierie' as StaffModuleKey }]
            : []),
          { to: '/ingenierie/taches', label: 'Tâches ingénieur', module: 'ingenierie' },
          { to: '/ingenierie/planning', label: 'Planning ingénieur', module: 'ingenierie' },
        ]),
      },
      {
        id: 'catalogue',
        label: 'Catalogue',
        module: 'catalogue',
        items: filterItems([
          { to: '/catalogue', label: 'Articles & essais', module: 'catalogue' },
          { to: '/materiel/equipements', label: 'Matériel / Équipements', module: 'catalogue' },
          { to: '/labo/fiches', label: 'Fiches techniques dynamiques', module: 'catalogue' },
        ]),
      },
      {
        id: 'configuration',
        label: 'Configuration',
        module: 'configuration',
        items: filterItems([
          ...(canManageAppConfig(user) || user?.role === 'lab_admin'
            ? [{ to: '/config/agences', label: 'Agences', module: 'configuration' as StaffModuleKey }]
            : []),
          ...(canManageUsers(user)
            ? [{ to: '/settings/utilisateurs', label: 'Utilisateurs', module: 'configuration' as StaffModuleKey }]
            : []),
          ...(canManageGroups(user)
            ? [{ to: '/settings/groupes', label: 'Groupes & droits', module: 'configuration' as StaffModuleKey, permission: 'groups.manage' }]
            : []),
          ...(canManageAppConfig(user)
            ? [
                { to: '/back-office/modeles-documents-pdf', label: 'PDF devis/factures', module: 'configuration' as StaffModuleKey },
                { to: '/back-office/configuration', label: 'Modules', module: 'configuration' as StaffModuleKey },
              ]
            : []),
        ]),
      },
      {
        id: 'rapports',
        label: 'Rapports',
        module: 'rapports',
        items: filterItems([
          { to: '/rapports/ventes', label: 'Ventes', module: 'rapports' },
          { to: '/rapports/compta', label: 'Comptabilité', module: 'rapports' },
          { to: '/rapports/kpi', label: 'KPI', module: 'rapports' },
        ]),
      },
    ]

    return allGroups.filter((group) => {
      if (group.id === 'commercial' && !canCommercial && !canDossiers) return false
      if (!canAccessStaffModule(user, group.module) && group.id !== 'commercial') return false
      if (group.id === 'commercial' && (canCommercial || canDossiers)) return group.items.length > 0
      return group.items.length > 0
    })
  }, [user])

  const closeAll = useCallback(() => {
    setOpenDropdown(null)
    setMobileOpen(false)
  }, [])

  useEffect(() => {
    closeAll()
  }, [location.pathname, closeAll])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const toggleDropdown = (id: string) => {
    setOpenDropdown((prev) => (prev === id ? null : id))
  }

  if (isPortalUser(user)) return null

  return (
    <header className="app-header" ref={navRef}>
      <div className="app-header-inner">
        <NavLink to="/" end className="app-brand app-brand--logo" onClick={closeAll} aria-label={`Accueil — ${DEFAULT_APP_LOGO_ALT}`}>
          <img
            src={logoSrc}
            alt={DEFAULT_APP_LOGO_ALT}
            width={220}
            height={54}
            decoding="async"
            className="app-brand__logo"
            onError={() => setLogoSrc(DEFAULT_APP_LOGO_SRC)}
          />
        </NavLink>

        <button
          type="button"
          className="nav-burger"
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="nav-burger-bar" />
          <span className="nav-burger-bar" />
          <span className="nav-burger-bar" />
        </button>

        <div
          id="main-navigation"
          className={`nav-shell ${mobileOpen ? 'nav-shell--open' : ''}`}
        >
          <nav className="nav-menu" aria-label="Navigation principale">
            {groups.map((group) => {
              const routeActive = isGroupActive(group.id, pathname)
              return (
                <div
                  key={group.id}
                  className={[
                    'nav-dropdown',
                    openDropdown === group.id ? 'nav-dropdown--open' : '',
                    routeActive ? 'nav-dropdown--route-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className="nav-dropdown-trigger"
                    aria-expanded={openDropdown === group.id}
                    aria-haspopup="true"
                    onClick={() => toggleDropdown(group.id)}
                  >
                    <span>{group.label}</span>
                    <span className="nav-dropdown-chevron" aria-hidden />
                  </button>
                  <ul className="nav-dropdown-panel" role="menu">
                    {group.items.map((item) => (
                      <li key={`${item.to}-${item.label}`} role="none">
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            `nav-dropdown-link${isActive ? ' nav-dropdown-link--active' : ''}`
                          }
                          role="menuitem"
                          onClick={closeAll}
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </nav>

          <div className="nav-user">
            <GlobalSearch />
            <NavLink
              to="/aide"
              className={({ isActive }) => `nav-aide-link${isActive ? ' nav-aide-link--active' : ''}`}
              title="Aide API (OpenAPI)"
              onClick={closeAll}
            >
              Aide
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-settings-gear${isActive ? ' nav-settings-gear--active' : ''}`}
              title="Paramètres"
              aria-label="Paramètres"
              onClick={closeAll}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </NavLink>
            <span className="nav-user-name" title={user?.email}>
              {user?.name}
              <span className="nav-user-role">({user?.role})</span>
            </span>
            <button type="button" className="btn btn-nav-logout" onClick={() => logout()}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Fermer le menu"
          onClick={closeAll}
        />
      )}
    </header>
  )
}
