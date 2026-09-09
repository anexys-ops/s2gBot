import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  effectivePortalModules,
  hasPortalModule,
  PORTAL_MODULE_LABELS,
  type PortalModuleKey,
} from '../lib/portalAccess'
import { userRoleLabel } from '../lib/userRolePresentation'

type NavItem = { to: string; label: string; end?: boolean; module?: PortalModuleKey }

export default function PortalNavigation() {
  const { user, logout } = useAuth()
  const modules = effectivePortalModules(user)

  const items = useMemo(() => {
    const nav: NavItem[] = [{ to: '/portal', label: 'Accueil', end: true }]
    if (hasPortalModule(user, 'dossiers')) {
      nav.push({ to: '/portal/dossiers', label: PORTAL_MODULE_LABELS.dossiers, module: 'dossiers' })
    }
    if (hasPortalModule(user, 'interventions')) {
      nav.push({ to: '/portal/interventions', label: 'Interventions', module: 'interventions' })
    }
    if (hasPortalModule(user, 'rapports')) {
      nav.push({ to: '/portal/rapports', label: 'Rapports livrés', module: 'rapports' })
    }
    if (hasPortalModule(user, 'devis')) {
      nav.push({ to: '/portal/devis', label: PORTAL_MODULE_LABELS.devis, module: 'devis' })
    }
    if (hasPortalModule(user, 'factures')) {
      nav.push({ to: '/portal/factures', label: PORTAL_MODULE_LABELS.factures, module: 'factures' })
    }
    return nav
  }, [user, modules])

  return (
    <header className="portal-nav">
      <div className="portal-nav__inner">
        <div className="portal-nav__brand">
          <span className="portal-nav__kicker">Espace client</span>
          <strong>{user?.client?.name ?? user?.name ?? 'Portail'}</strong>
          {user?.site?.name && <span className="portal-nav__site">{user.site.name}</span>}
        </div>
        <nav className="portal-nav__links" aria-label="Navigation portail client">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `portal-nav__link${isActive ? ' portal-nav__link--active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="portal-nav__user">
          <span className="portal-nav__role">{userRoleLabel(user?.role)}</span>
          <span className="portal-nav__email">{user?.email}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void logout()}>
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  )
}
