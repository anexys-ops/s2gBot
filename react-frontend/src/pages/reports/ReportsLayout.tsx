import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/rapports/compta', label: 'Comptabilité' },
  { to: '/rapports/ventes', label: 'Ventes' },
  { to: '/rapports/delai-traitement', label: 'Délais de traitement' },
  { to: '/rapports/delai-chantier', label: 'Délais chantier' },
] as const

export default function ReportsLayout() {
  return (
    <div className="reports-hub">
      <header className="reports-hub__head">
        <p className="hub-kicker">Rapports</p>
        <h1 className="reports-hub__title">Indicateurs &amp; analyses</h1>
        <p className="reports-hub__lead">Quatre vues : comptabilité, ventes, délais laboratoire et délais chantier.</p>
      </header>
      <nav className="reports-hub__tabs" aria-label="Sections rapports">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `reports-hub__tab${isActive ? ' reports-hub__tab--active' : ''}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="reports-hub__panel">
        <Outlet />
      </div>
    </div>
  )
}
