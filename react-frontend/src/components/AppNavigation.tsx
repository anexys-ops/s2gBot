import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type SubItem = { to: string; label: string }

type MenuGroup = {
  id: string
  label: string
  items: SubItem[]
}

export default function AppNavigation() {
  const { user, logout } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const activityItems: SubItem[] = [
    { to: '/', label: 'Accueil' },
    { to: '/orders', label: 'Commandes' },
    ...(isLab ? [] : [{ to: '/back-office/catalogue-essais', label: 'Catalogue essais' }]),
    { to: '/graphiques-essais', label: 'Graphiques essais' },
  ]

  const facturationItems: SubItem[] = isLab
    ? [
        { to: '/crm/documents', label: 'Documents commerciaux (CRM)' },
        { to: '/devis', label: 'Devis' },
        { to: '/invoices', label: 'Factures' },
        { to: '/back-office/pdf', label: 'Création PDF' },
        { to: '/back-office/mails', label: 'Gestion des mails' },
      ]
    : [
        { to: '/crm/documents', label: 'Mes documents commerciaux' },
        { to: '/invoices', label: 'Factures' },
      ]

  const rapportsItems: SubItem[] = [
    { to: '/rapports/compta', label: 'Rapport compta' },
    { to: '/rapports/ventes', label: 'Stats ventes & rapports' },
    { to: '/rapports/delai-traitement', label: 'Délais de traitement' },
    { to: '/rapports/delai-chantier', label: 'Délais chantier' },
  ]

  const groups: MenuGroup[] = [
    { id: 'activity', label: 'Activité', items: activityItems },
    { id: 'reports', label: 'Rapports', items: rapportsItems },
    { id: 'billing', label: 'Facturation & documents', items: facturationItems },
  ]

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
        <NavLink to="/" className="app-brand" onClick={closeAll}>
          Lab BTP
        </NavLink>

        <div className="nav-app-modes" role="navigation" aria-label="Espaces métier">
          <NavLink
            to="/crm"
            className={({ isActive }) => `nav-mode-link${isActive ? ' nav-mode-link--active' : ''}`}
            onClick={closeAll}
          >
            CRM
          </NavLink>
          <NavLink
            to="/terrain"
            title="Terrain & laboratoire — prise de mesure et dossiers"
            className={({ isActive }) => `nav-mode-link${isActive ? ' nav-mode-link--active' : ''}`}
            onClick={closeAll}
          >
            <span className="nav-mode-link-text-full">Terrain & labo</span>
            <span className="nav-mode-link-text-short" aria-hidden>
              Terrain
            </span>
          </NavLink>
          {isLab ? (
            <NavLink
              to="/back-office"
              title="Back office — catalogue, granulo, cadrage, clients…"
              className={({ isActive }) => `nav-mode-link${isActive ? ' nav-mode-link--active' : ''}`}
              onClick={closeAll}
            >
              <span className="nav-mode-link-text-full">Back office</span>
              <span className="nav-mode-link-text-short" aria-hidden>
                BO
              </span>
            </NavLink>
          ) : null}
        </div>

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
            {groups.map((group) => (
              <div
                key={group.id}
                className={`nav-dropdown ${openDropdown === group.id ? 'nav-dropdown--open' : ''}`}
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
            ))}
          </nav>

          <div className="nav-user">
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
