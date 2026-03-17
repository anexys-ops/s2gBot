import { Link } from "react-router-dom";

const modulesList = [
  {
    to: "/modules/back",
    title: "Back (Items)",
    description: "Gérer les éléments et les données du service back.",
    icon: "▣",
    iconClass: "back",
  },
  {
    to: "/modules/calcul",
    title: "Calcul",
    description: "Service de calcul (somme, etc.).",
    icon: "∑",
    iconClass: "calcul",
  },
  {
    to: "/modules/auth",
    title: "Auth",
    description: "Authentification et gestion des accès.",
    icon: "◆",
    iconClass: "auth",
  },
  {
    to: "/modules/health",
    title: "Santé des services",
    description: "État des services et du gateway.",
    icon: "✓",
    iconClass: "health",
  },
];

export default function Dashboard() {
  return (
    <>
      <header className="page-header">
        <h1>Tableau de bord</h1>
        <p>Choisissez un module pour gérer l’application.</p>
      </header>
      <div className="modules-grid">
        {modulesList.map((m) => (
          <Link key={m.to} to={m.to} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="module-card">
              <h3>
                <span className={`icon ${m.iconClass}`}>{m.icon}</span>
                {m.title}
              </h3>
              <p>{m.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
