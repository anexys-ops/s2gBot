import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="dashboard-home">
      <h1>Bienvenue, {user?.name}</h1>
      <p className="dashboard-tagline">
        Une seule plateforme : CRM (commercial, terrain administratif) et espace mesures /
        laboratoire. Ouvre les deux vues en parallèle dans deux onglets si besoin.
      </p>

      <div className="dashboard-split">
        <Link to="/crm" className="dashboard-panel dashboard-panel--crm">
          <span className="dashboard-panel-label">CRM</span>
          <strong>Commercial & clients</strong>
          <span className="dashboard-panel-hint">
            Clients, chantiers, devis, factures, mails et PDF.
          </span>
        </Link>
        <Link to="/terrain" className="dashboard-panel dashboard-panel--terrain">
          <span className="dashboard-panel-label">Terrain & labo</span>
          <strong>Prise de mesure & dossiers</strong>
          <span className="dashboard-panel-hint">
            Commandes, nouvelle saisie, catalogue, graphiques et calculs.
          </span>
        </Link>
      </div>

      <p className="dashboard-shortcuts-title">Accès rapides</p>
      <div className="dashboard-shortcuts">
        <Link to="/orders" className="btn btn-secondary">
          Commandes
        </Link>
        <Link to="/back-office/catalogue-essais" className="btn btn-secondary">
          Catalogue essais
        </Link>
        <Link to="/invoices" className="btn btn-secondary">
          Factures
        </Link>
      </div>
    </div>
  )
}
