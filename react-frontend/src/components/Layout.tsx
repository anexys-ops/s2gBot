import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  return (
    <>
      <nav>
        <NavLink to="/">Accueil</NavLink>
        <NavLink to="/orders">Commandes</NavLink>
        <NavLink to="/catalog">Catalogue essais</NavLink>
        <NavLink to="/graphiques-essais">Graphiques essais</NavLink>
        {isLab && (
          <>
            <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>Back office :</span>
            <NavLink to="/devis">Devis</NavLink>
            <NavLink to="/invoices">Factures</NavLink>
            <NavLink to="/back-office/pdf">PDF</NavLink>
            <NavLink to="/back-office/mails">Mails</NavLink>
            <NavLink to="/back-office/cadrage">Cadrage (S0)</NavLink>
            <NavLink to="/back-office/exemples-calculs">Calculs BTP</NavLink>
            <NavLink to="/clients">Clients</NavLink>
            <NavLink to="/sites">Chantiers</NavLink>
          </>
        )}
        {!isLab && <NavLink to="/invoices">Factures</NavLink>}
        <span style={{ marginLeft: 'auto' }}>
          {user?.name} ({user?.role})
        </span>
        <button type="button" className="btn btn-secondary" onClick={() => logout()} style={{ marginLeft: '0.5rem' }}>
          Déconnexion
        </button>
      </nav>
      <main className="container" style={{ paddingTop: '1.5rem' }}>
        <Outlet />
      </main>
    </>
  )
}
