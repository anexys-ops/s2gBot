import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Logo from "./Logo";

const modules = [
  { to: "/", label: "Tableau de bord", icon: "◉" },
  { to: "/modules/back", label: "Back (Items)", icon: "▣" },
  { to: "/modules/calcul", label: "Calcul", icon: "∑" },
  { to: "/modules/auth", label: "Auth", icon: "◆" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo variant="full" size="sm" />
        </div>
        <nav className="sidebar-nav">
          {modules.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.to === "/"}
              className={({ isActive }) =>
                "sidebar-link" + (isActive ? " active" : "")
              }
            >
              <span>{m.icon}</span>
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user" title={user?.email ?? ""}>
            {user?.email ?? "—"}
          </div>
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
