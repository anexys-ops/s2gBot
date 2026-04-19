import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type SubItem = { to: string; label: string }

type MenuGroupId = 'crm' | 'terrain' | 'activity' | 'reports'

type MenuGroup = {
  id: MenuGroupId
  label: string
  items: SubItem[]
}

function isCrmModuleActive(pathname: string, isLab: boolean): boolean {
  if (pathname.startsWith('/crm')) return true
  if (pathname.startsWith('/clients')) return true
  if (pathname.startsWith('/sites')) return true
  if (pathname.startsWith('/devis')) return true
  if (pathname.startsWith('/invoices')) return true
  if (
    isLab &&
    (pathname.startsWith('/back-office/catalogue-commercial') ||
      pathname.startsWith('/back-office/pdf') ||
      pathname.startsWith('/back-office/mails'))
  ) {
    return true
  }
  return false
}

function isTerrainModuleActive(pathname: string, isLab: boolean): boolean {
  if (pathname.startsWith('/graphiques-essais')) return false
  if (pathname.startsWith('/terrain')) return true
  if (pathname.startsWith('/orders')) return true
  if (!isLab) {
    if (pathname.startsWith('/back-office/catalogue-essais')) return true
    if (pathname.startsWith('/back-office/granulometrie')) return true
    return false
  }
  if (!pathname.startsWith('/back-office')) return false
  if (pathname.startsWith('/back-office/catalogue-commercial')) return false
  if (pathname.startsWith('/back-office/pdf')) return false
  if (pathname.startsWith('/back-office/mails')) return false
  return true
}

function isActivityModuleActive(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/graphiques-essais')
}

function isReportsModuleActive(pathname: string): boolean {
  return pathname.startsWith('/rapports')
}

function isGroupActive(id: MenuGroupId, pathname: string, isLab: boolean): boolean {
  switch (id) {
    case 'crm':
      return isCrmModuleActive(pathname, isLab)
    case 'terrain':
      return isTerrainModuleActive(pathname, isLab)
    case 'activity':
      return isActivityModuleActive(pathname)
    case 'reports':
      return isReportsModuleActive(pathname)
    default:
      return false
  }
}

export default function AppNavigation() {
  const { user, logout } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const location = useLocation()
  const pathname = location.pathname
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const groups: MenuGroup[] = useMemo(() => {
    const crmItems: SubItem[] = [
      { to: '/crm', label: 'Vue d’ensemble CRM' },
      { to: '/crm/documents', label: 'Documents commerciaux' },
      { to: '/clients', label: 'Clients' },
      { to: '/sites', label: 'Chantiers' },
      { to: '/devis', label: 'Devis' },
      { to: '/invoices', label: 'Factures' },
    ]
    if (isLab) {
      crmItems.push(
        { to: '/back-office/catalogue-commercial', label: 'Catalogue commercial' },
        { to: '/back-office/pdf', label: 'Création PDF' },
        { to: '/back-office/mails', label: 'Gestion des mails' },
      )
    }

    const terrainItems: SubItem[] = [
      { to: '/terrain', label: 'Vue d’ensemble terrain & labo' },
      { to: '/orders', label: 'Commandes & dossiers' },
      { to: '/orders/new', label: 'Nouvelle commande' },
    ]
    if (isLab) {
      terrainItems.push({ to: '/back-office', label: 'Back office labo' })
    } else {
      terrainItems.push(
        { to: '/back-office/catalogue-essais', label: 'Catalogue des essais' },
        { to: '/back-office/granulometrie', label: 'Granulométrie' },
      )
    }

    const activityItems: SubItem[] = [
      { to: '/', label: 'Accueil' },
      { to: '/graphiques-essais', label: 'Graphiques essais' },
    ]

    const rapportsItems: SubItem[] = [
      { to: '/rapports/compta', label: 'Rapport compta' },
      { to: '/rapports/ventes', label: 'Stats ventes & rapports' },
      { to: '/rapports/delai-traitement', label: 'Délais de traitement' },
      { to: '/rapports/delai-chantier', label: 'Délais chantier' },
    ]

    return [
      { id: 'crm', label: 'CRM', items: crmItems },
      { id: 'terrain', label: 'Terrain & labo', items: terrainItems },
      { id: 'activity', label: 'Activité', items: activityItems },
      { id: 'reports', label: 'Rapports', items: rapportsItems },
    ]
  }, [isLab])

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

  return (
    <header className="app-header" ref={navRef}>
      <div className="app-header-inner">
        <NavLink to="/" end className="app-brand" onClick={closeAll}>
          Lab BTP
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
              const routeActive = isGroupActive(group.id, pathname, isLab)
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
                      <li key={item.to} role="none">
                        <NavLink
                          to={item.to}
                          end={item.to === '/'}
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
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-settings-gear${isActive ? ' nav-settings-gear--active' : ''}`}
              title="Paramètres du compte"
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
