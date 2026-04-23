import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

export type ModuleBreadcrumb = { label: string; to?: string }

export type ModuleTab = {
  to: string
  label: string
  end?: boolean
}

type Props = {
  /** Fil d’Ariane (ex. Commercial › Clients › Société X) */
  breadcrumbs: ModuleBreadcrumb[]
  /** Libellé court dans la barre bleue (ex. Tiers, Commercial) */
  moduleBarLabel: string
  /** Titre principal de la fiche ou de la liste */
  title: string
  /** Sous-titre ou référence (#123) */
  subtitle?: ReactNode
  /** Onglets style Dolibarr (Fiche, Documents…) */
  tabs?: ModuleTab[]
  /** Entre l’en-tête et les onglets : raccourcis (ex. liens vers une autre zone du module). */
  tabsAccessory?: ReactNode
  /** Boutons Nouveau / Liste / Modifier / Supprimer */
  actions?: ReactNode
  /** Classe(s) sur la racine `.module-shell` (ex. défilement horizontal des onglets) */
  shellClassName?: string
  children: ReactNode
}

export default function ModuleEntityShell({
  breadcrumbs,
  moduleBarLabel,
  title,
  subtitle,
  tabs,
  tabsAccessory,
  actions,
  shellClassName,
  children,
}: Props) {
  return (
    <div className={['module-shell', shellClassName].filter(Boolean).join(' ')}>
      <div className="module-shell__bar">
        <span className="module-shell__bar-label">{moduleBarLabel}</span>
      </div>
      <div className="module-shell__body">
        <nav className="module-shell__breadcrumb" aria-label="Fil d’Ariane">
          {breadcrumbs.map((b, i) => (
            <span key={`${b.label}-${i}`} className="module-shell__breadcrumb-item">
              {i > 0 && <span className="module-shell__breadcrumb-sep"> › </span>}
              {b.to ? (
                <Link to={b.to}>{b.label}</Link>
              ) : (
                <span className="module-shell__breadcrumb-current">{b.label}</span>
              )}
            </span>
          ))}
        </nav>

        <header className="module-shell__header">
          <div className="module-shell__titles">
            <h1 className="module-shell__title">{title}</h1>
            {subtitle != null && subtitle !== '' ? (
              typeof subtitle === 'string' ? (
                <p className="module-shell__subtitle">{subtitle}</p>
              ) : (
                <div className="module-shell__subtitle">{subtitle}</div>
              )
            ) : null}
          </div>
          {actions ? <div className="module-shell__actions">{actions}</div> : null}
        </header>

        {tabsAccessory ? <div className="module-shell__tabs-accessory">{tabsAccessory}</div> : null}

        {tabs && tabs.length > 0 ? (
          <div className="module-shell__tabs-wrap">
            <nav className="module-shell__tabs" aria-label="Sections">
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `module-shell__tab${isActive ? ' module-shell__tab--active' : ''}`
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
        ) : null}

        <div className="module-shell__content">{children}</div>
      </div>
    </div>
  )
}
