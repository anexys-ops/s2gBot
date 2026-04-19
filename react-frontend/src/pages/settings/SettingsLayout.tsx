import { NavLink, Outlet } from 'react-router-dom'
import PageBackNav from '../../components/PageBackNav'
import { useAuth } from '../../contexts/AuthContext'
import { canManageGroups, canManageUsers } from '../../lib/settingsAccess'

export default function SettingsLayout() {
  const { user } = useAuth()
  const showUsers = canManageUsers(user)
  const showGroups = canManageGroups(user)

  return (
    <div className="settings-layout">
      <PageBackNav back={{ to: '/', label: 'Tableau de bord' }} />
      <h1>Paramètres</h1>
      <p style={{ color: 'var(--color-muted)', maxWidth: '62ch', lineHeight: 1.5, marginTop: 0 }}>
        Compte, sécurité, jetons d’API, charte visuelle. La gestion des utilisateurs et des groupes est réservée aux profils
        autorisés.
      </p>
      <nav className="settings-layout__tabs" aria-label="Sections paramètres">
        <NavLink
          to="/settings/compte"
          className={({ isActive }) => `settings-layout__tab${isActive ? ' settings-layout__tab--active' : ''}`}
        >
          Compte
        </NavLink>
        <NavLink
          to="/settings/securite"
          className={({ isActive }) => `settings-layout__tab${isActive ? ' settings-layout__tab--active' : ''}`}
        >
          Sécurité &amp; API
        </NavLink>
        <NavLink
          to="/settings/charte"
          className={({ isActive }) => `settings-layout__tab${isActive ? ' settings-layout__tab--active' : ''}`}
        >
          Charte &amp; logo
        </NavLink>
        {showUsers ? (
          <NavLink
            to="/settings/utilisateurs"
            className={({ isActive }) => `settings-layout__tab${isActive ? ' settings-layout__tab--active' : ''}`}
          >
            Utilisateurs
          </NavLink>
        ) : null}
        {showGroups ? (
          <NavLink
            to="/settings/groupes"
            className={({ isActive }) => `settings-layout__tab${isActive ? ' settings-layout__tab--active' : ''}`}
          >
            Groupes &amp; droits
          </NavLink>
        ) : null}
      </nav>
      <Outlet />
    </div>
  )
}
