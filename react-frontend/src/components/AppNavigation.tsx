import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { brandingApi } from '../api/client'
import GlobalSearch from './GlobalSearch'

type SubItem = { to: string; label: string; labOnly?: boolean }

type MenuGroupId =
  | 'catalogue'
  | 'clients'
  | 'commercial'
  | 'chantier'
  | 'materiel'
  | 'laboratoire'
  | 'configuration'
  | 'rapports'

type MenuGroup = {
  id: MenuGroupId
  label: string
  items: SubItem[]
}

function isCatalogueActive(pathname: string): boolean {
  return pathname === '/catalogue' || pathname.startsWith('/catalogue/')
}

function isClientsActive(pathname: string): boolean {
  return pathname === '/clients' || pathname.startsWith('/clients/')
}

function isCommercialActive(pathname: string): boolean {
  if (pathname.startsWith('/crm')) return true
  if (pathname.startsWith('/dossiers')) return true
  if (pathname.startsWith('/devis')) return true
  if (pathname.startsWith('/invoices')) return true
  if (pathname.startsWith('/bons-commande')) return true
  if (pathname.startsWith('/bons-livraison')) return true
  if (pathname.startsWith('/compta-fondation')) return true
  if (pathname.startsWith('/back-office/offres')) return true
  return false
}

function isChantierActive(pathname: string): boolean {
  return pathname === '/sites' || pathname.startsWith('/sites/') || pathname.startsWith('/terrain')
}

function isMaterielActive(pathname: string): boolean {
  return pathname.startsWith('/materiel')
}

function isLaboratoireActive(pathname: string): boolean {
  if (pathname.startsWith('/graphiques-essais')) return true
  if (pathname.startsWith('/labo')) return true
  if (pathname.startsWith('/orders')) return true
  if (pathname.startsWith('/back-office/granulometrie')) return true
  if (pathname.startsWith('/back-office/cadrage')) return true
  if (pathname.startsWith('/back-office/exemples-calculs')) return true
  return false
}

function isConfigurationActive(pathname: string): boolean {
  if (pathname.startsWith('/settings')) return true
  if (pathname === '/aide' || pathname.startsWith('/aide/')) return true
  if (pathname.startsWith('/back-office/pdf')) return true
  if (pathname.startsWith('/back-office/mails')) return true
  if (pathname.startsWith('/back-office/modeles-')) return true
  if (pathname.startsWith('/back-office/configuration')) return true
  if (pathname.startsWith('/back-office/journal-audit')) return true
  if (pathname.startsWith('/back-office/non-conformites')) return true
  return false
}

function isReportsActive(pathname: string): boolean {
  return pathname.startsWith('/rapports')
}

function isGroupActive(id: MenuGroupId, pathname: string): boolean {
  switch (id) {
    case 'catalogue':
      return isCatalogueActive(pathname)
    case 'clients':
      return isClientsActive(pathname)
    case 'commercial':
      return isCommercialActive(pathname)
    case 'chantier':
      return isChantierActive(pathname)
    case 'materiel':
      return isMaterielActive(pathname)
    case 'laboratoire':
      return isLaboratoireActive(pathname)
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
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => brandingApi.get(),
    enabled: Boolean(user),
    staleTime: 120_000,
  })
  const brandLogoSrc = branding?.logo_url && branding.logo_url.trim() !== '' ? branding.logo_url : '/logo-vertical.svg'
  const location = useLocation()
  const pathname = location.pathname
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const groups: MenuGroup[] = useMemo(() => {
    const filterItems = (items: SubItem[]) => items.filter((i) => !i.labOnly || isLab)

    return [
      {
        id: 'catalogue',
        label: 'Catalogue',
        items: filterItems([
          { to: '/catalogue', label: 'Articles' },
          { to: '/catalogue/services?kind=service', label: 'Services' },
          { to: '/catalogue?vue=familles', label: 'Familles' },
          { to: '/catalogue?vue=tags', label: 'Tags' },
        ]),
      },
      {
        id: 'clients',
        label: 'Clients',
        items: filterItems([
          { to: '/clients', label: 'Clients' },
          { to: '/clients/contacts', label: 'Contacts' },
          { to: '/clients/carte', label: 'Carte' },
        ]),
      },
      {
        id: 'commercial',
        label: 'Commercial',
        items: filterItems([
          { to: '/crm', label: 'Vue d’ensemble' },
          { to: '/dossiers', label: 'Dossiers' },
          { to: '/devis', label: 'Devis' },
          { to: '/bons-commande', label: 'Bons de commande' },
          { to: '/bons-livraison', label: 'Bons de livraison' },
          { to: '/invoices', label: 'Factures' },
          { to: '/compta-fondation', label: 'Compta', labOnly: true },
          { to: '/back-office/offres', label: 'Offres', labOnly: true },
          { to: '/ordres-mission', label: 'Ordres de mission' },
        ]),
      },
      {
        id: 'chantier',
        label: 'Chantier',
        items: filterItems([
          { to: '/sites', label: 'Chantiers' },
          { to: '/terrain', label: 'Vue terrain' },
          { to: '/ordres-mission', label: 'Ordres de mission' },
          { to: '/terrain/mesures', label: 'Mesures terrain' },
          { to: '/terrain/planning', label: 'Planning technicien' },
        ]),
      },
      {
        id: 'materiel',
        label: 'Matériel',
        items: filterItems([
          { to: '/materiel', label: 'Vue d’ensemble' },
          { to: '/materiel/equipements', label: 'Parc équipements' },
          { to: '/materiel/planning', label: 'Planning matériel' },
          { to: '/materiel/stocks', label: 'Stocks' },
        ]),
      },
      {
        id: 'laboratoire',
        label: 'Laboratoire',
        items: filterItems([
          { to: '/labo', label: 'Vue laboratoire' },
          { to: '/labo/essais', label: 'Essais et graphiques' },
          { to: '/graphiques-essais', label: 'Graphiques d’essais' },
          { to: '/orders', label: 'Dossiers et commandes' },
          { to: '/orders/new', label: 'Nouvelle commande' },
          { to: '/back-office/granulometrie', label: 'Granulométrie', labOnly: true },
          { to: '/back-office/cadrage', label: 'Cadrage' },
          { to: '/back-office/exemples-calculs', label: 'Exemples de calculs' },
        ]),
      },
      {
        id: 'configuration',
        label: 'Config',
        items: filterItems([
          { to: '/settings', label: 'Compte, sécurité, marque' },
          { to: '/settings/utilisateurs', label: 'Utilisateurs', labOnly: true },
          { to: '/settings/groupes', label: 'Groupes et accès', labOnly: true },
          { to: '/settings/charte', label: 'Charte (logo, couleurs)', labOnly: true },
          { to: '/back-office/modeles-documents-pdf', label: 'Modèles de documents PDF', labOnly: true },
          { to: '/back-office/modeles-rapports-pdf', label: 'Modèles de rapports PDF', labOnly: true },
          { to: '/back-office/pdf', label: 'Création de PDF' },
          { to: '/back-office/mails', label: 'Mails', labOnly: true },
          { to: '/back-office/configuration', label: 'Modules (activation)', labOnly: true },
          { to: '/back-office/journal-audit', label: 'Journal d’audit', labOnly: true },
          { to: '/back-office/non-conformites', label: 'Non-conformités' },
          { to: '/aide', label: 'API (OpenAPI)' },
        ]),
      },
      {
        id: 'rapports',
        label: 'Rapports',
        items: filterItems([{ to: '/rapports', label: 'Rapports (compta, ventes, délais)' }]),
      },
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
        <NavLink to="/" end className="app-brand app-brand--logo" onClick={closeAll} aria-label="Accueil — Lab BTP">
          <img
            src={brandLogoSrc}
            alt=""
            width={220}
            height={54}
            decoding="async"
            className="app-brand__logo"
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
