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
  | 'planification'
  | 'terrain'
  | 'laboratoire'
  | 'essais'
  | 'materiel'
  | 'ingenierie'
  | 'catalogue'
  | 'configuration'
  | 'rapports'

type MenuGroup = {
  id: MenuGroupId
  label: string
  module?: StaffModuleKey
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
  if (pathname.startsWith('/terrain/taches') || pathname.startsWith('/terrain/planning')) return false
  if (pathname.startsWith('/terrain')) return true
  if (pathname.startsWith('/notes-de-frais')) return true
  return false
}

function isLaboratoireActive(pathname: string): boolean {
  if (pathname.startsWith('/labo/taches') || pathname.startsWith('/labo/planning')) return false
  if (pathname.startsWith('/labo')) return true
  return false
}

function isPlanificationActive(pathname: string): boolean {
  if (pathname === '/planning') return true
  if (pathname.startsWith('/ordres-mission')) return true
  if (pathname.startsWith('/labo/taches') || pathname.startsWith('/labo/planning')) return true
  if (pathname.startsWith('/materiel/planning')) return true
  if (pathname.startsWith('/terrain/taches') || pathname.startsWith('/terrain/planning')) return true
  return false
}

function isIngenerieActive(pathname: string): boolean {
  if (pathname.startsWith('/ingenierie')) return true
  return false
}

function isCatalogueActive(pathname: string): boolean {
  if (pathname === '/catalogue' || pathname.startsWith('/catalogue/')) return true
  return false
}

function isMaterielActive(pathname: string): boolean {
  if (pathname.startsWith('/materiel/planning')) return false
  return pathname.startsWith('/materiel')
}

function isConfigurationActive(pathname: string): boolean {
  if (pathname.startsWith('/config/listes-essais')) return true
  if (pathname.startsWith('/config/agences')) return true
  if (pathname.startsWith('/config/centres')) return true
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
    case 'planification':
      return isPlanificationActive(pathname)
    case 'terrain':
      return isTerrainActive(pathname)
    case 'laboratoire':
      return isLaboratoireActive(pathname)
    case 'essais':
      return pathname.startsWith('/catalogue/essais')
    case 'materiel':
      return isMaterielActive(pathname)
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
  const [configOpen, setConfigOpen] = useState(false)
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
        id: 'planification',
        label: 'Planification',
        items: filterItems([
          { to: '/planning', label: 'Planning global' },
          ...(canOdm ? [{ to: '/ordres-mission', label: 'Ordres de missions' }] : []),
          { to: '/terrain/planning', label: 'Planning terrain', module: 'terrain' },
          { to: '/terrain/taches', label: 'Tâches terrain', module: 'terrain' },
          { to: '/labo/planning', label: 'Planning laboratoire', module: 'laboratoire' },
          { to: '/labo/taches', label: 'Tâches laboratoire', module: 'laboratoire' },
          { to: '/materiel/planning', label: 'Planning matériel', module: 'catalogue' },
        ]),
      },
      {
        id: 'terrain',
        label: 'Terrain',
        module: 'terrain',
        items: filterItems([
          { to: '/terrain/chantiers', label: 'Chantiers et carte GPS', module: 'terrain' },
          { to: '/terrain/mesures', label: 'Mesures terrain', module: 'terrain' },
          { to: '/rapport-bc', label: 'Rapports de mission', module: 'rapport-bc' },
          { to: '/notes-de-frais', label: 'Notes de frais', module: 'terrain' },
        ]),
      },
      {
        id: 'laboratoire',
        label: 'Laboratoire',
        module: 'laboratoire',
        items: filterItems([
          { to: '/labo/reception', label: 'Réception (FOLD)', module: 'laboratoire' },
          { to: '/labo/rapports', label: "Rapports d'essais", module: 'laboratoire' },
          { to: '/rapport-bc', label: 'Rapports de mission', module: 'rapport-bc' },
          { to: '/labo/fiches', label: 'Fiches techniques', module: 'laboratoire' },
          { to: '/labo/transco', label: 'Transco FOLD', module: 'laboratoire', permission: 'config.manage' },
        ]),
      },
      {
        id: 'essais',
        label: 'Essais',
        items: filterItems([
          { to: '/catalogue/essais', label: 'Types d’essais et formulaires' },
          { to: '/graphiques-essais', label: 'Graphiques d’essais', module: 'laboratoire' },
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
          { to: '/rapport-bc', label: 'Rapports de mission', module: 'rapport-bc' },
        ]),
      },
      {
        id: 'materiel',
        label: 'Matériel',
        module: 'catalogue',
        items: filterItems([
          { to: '/materiel/equipements', label: 'Équipements', module: 'catalogue' },
          { to: '/materiel/planning', label: 'Planning matériel', module: 'catalogue' },
          { to: '/materiel/stocks', label: 'Stocks', module: 'catalogue' },
        ]),
      },
      {
        id: 'rapports',
        label: 'Statistiques',
        module: 'rapports',
        items: filterItems([
          { to: '/rapports/ventes', label: 'Ventes', module: 'rapports' },
          { to: '/rapports/compta', label: 'Comptabilité', module: 'rapports' },
          { to: '/rapports/kpi', label: 'KPI', module: 'rapports' },
        ]),
      },
    ]

    return allGroups.filter((group) => {
      if (group.id === 'essais') return canAccessStaffModule(user, 'catalogue') || canAccessStaffModule(user, 'laboratoire')
      if (group.id === 'commercial' && !canCommercial && !canDossiers) return false
      if (group.module && !canAccessStaffModule(user, group.module) && group.id !== 'commercial') return false
      if (group.id === 'commercial' && (canCommercial || canDossiers)) return group.items.length > 0
      return group.items.length > 0
    })
  }, [user])

  const catalogueItems = useMemo(() => {
    const filterItems = (items: SubItem[]) =>
      items.filter((item) => {
        if (item.permission && !hasStaffCapability(user, item.permission)) return false
        if (item.module && !canAccessStaffModule(user, item.module)) return false
        return true
      })
    return filterItems([
      { to: '/catalogue', label: 'Articles & essais', module: 'catalogue' as StaffModuleKey },
      { to: '/catalogue/essais', label: 'Types d’essais et formulaires' },
      { to: '/labo/fiches', label: 'Fiches techniques', module: 'laboratoire' as StaffModuleKey },
    ])
  }, [user])

  const configItems = useMemo(() => {
    const items: SubItem[] = []
    if (canManageAppConfig(user) || user?.role === 'lab_admin')
      items.push({ to: '/config/agences', label: 'Agences', module: 'configuration' as StaffModuleKey })
    if (canManageUsers(user))
      items.push({ to: '/settings/utilisateurs', label: 'Utilisateurs', module: 'configuration' as StaffModuleKey })
    if (canManageGroups(user))
      items.push({ to: '/settings/groupes', label: 'Groupes & droits', module: 'configuration' as StaffModuleKey })
    if (canManageAppConfig(user)) {
      items.push({ to: '/config/listes-essais', label: 'Listes de choix des essais', module: 'configuration' as StaffModuleKey })
      items.push({ to: '/back-office/modeles-documents-pdf', label: 'Modèles PDF', module: 'configuration' as StaffModuleKey })
      items.push({ to: '/back-office/configuration', label: 'Modules', module: 'configuration' as StaffModuleKey })
    }
    items.push({ to: '/settings', label: 'Mon compte', module: 'configuration' as StaffModuleKey })
    return items
  }, [user])

  const isConfigOrCatalogueActive = isCatalogueActive(pathname) || isConfigurationActive(pathname) || pathname.startsWith('/settings') || pathname.startsWith('/config/')

  const closeAll = useCallback(() => {
    setOpenDropdown(null)
    setMobileOpen(false)
    setConfigOpen(false)
  }, [])

  useEffect(() => {
    closeAll()
  }, [location.pathname, closeAll])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
        setConfigOpen(false)
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
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`nav-settings-gear${isConfigOrCatalogueActive || configOpen ? ' nav-settings-gear--active' : ''}`}
                title="Configuration & Catalogue"
                aria-label="Configuration & Catalogue"
                aria-expanded={configOpen}
                onClick={() => { setConfigOpen((v) => !v); setOpenDropdown(null) }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {configOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 9999,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, padding: '8px 0',
                }}>
                  {catalogueItems.length > 0 && (
                    <>
                      <div style={{ padding: '4px 16px 4px', fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Catalogue
                      </div>
                      {catalogueItems.map((item) => (
                        <NavLink key={item.to} to={item.to} onClick={closeAll}
                          className={({ isActive }) => `nav-dropdown-link${isActive ? ' nav-dropdown-link--active' : ''}`}
                          style={{ display: 'block', padding: '7px 16px' }}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                      <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />
                    </>
                  )}
                  <div style={{ padding: '4px 16px 4px', fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Configuration
                  </div>
                  {configItems.map((item) => (
                    <NavLink key={item.to} to={item.to} onClick={closeAll}
                      className={({ isActive }) => `nav-dropdown-link${isActive ? ' nav-dropdown-link--active' : ''}`}
                      style={{ display: 'block', padding: '7px 16px' }}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
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
