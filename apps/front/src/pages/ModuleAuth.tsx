import { useAuth } from "../contexts/AuthContext";

export default function ModuleAuth() {
  const { user } = useAuth();

  return (
    <>
      <header className="page-header">
        <h1>Auth</h1>
        <p>Authentification et session.</p>
      </header>
      <div className="module-card" style={{ maxWidth: "400px" }}>
        <h3 style={{ marginTop: 0 }}>Session actuelle</h3>
        <p>
          Connecté avec : <strong>{user?.email ?? "—"}</strong>
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          Le token est stocké localement. Utilisez « Déconnexion » dans la barre latérale pour vous déconnecter.
        </p>
      </div>
    </>
  );
}
