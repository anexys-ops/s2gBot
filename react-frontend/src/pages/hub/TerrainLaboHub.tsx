import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

type Card = { to: string; title: string; desc: string }

export default function TerrainLaboHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'

  const cards: Card[] = [
    {
      to: '/orders',
      title: 'Commandes & dossiers',
      desc: 'Liste des dossiers : prélèvements, échantillons, statuts.',
    },
    {
      to: '/orders/new',
      title: 'Nouvelle commande',
      desc: 'Créer un dossier depuis le terrain ou le labo.',
    },
    {
      to: '/back-office/catalogue-essais',
      title: 'Catalogue des essais',
      desc: 'Types d’essais, normes et paramètres.',
    },
    {
      to: '/graphiques-essais',
      title: 'Graphiques essais',
      desc: 'Visualisation des séries de résultats.',
    },
  ]

  if (isLab) {
    cards.push(
      { to: '/back-office/cadrage', title: 'Cadrage (S0)', desc: 'Paramètres et cadrage dossier.' },
      { to: '/back-office/exemples-calculs', title: 'Calculs BTP', desc: 'Outils de calcul normes.' },
    )
  }

  if (isAdmin) {
    cards.push({
      to: '/back-office/modeles-rapports-pdf',
      title: 'Modèles PDF rapports',
      desc: 'Modèle par défaut pour les rapports générés depuis les commandes.',
    })
  }

  return (
    <div className="hub-page hub-page--terrain terrain-touch">
      <header className="hub-header">
        <h1>Terrain & laboratoire</h1>
        <p className="hub-lead">
          Vue optimisée pour techniciens : commandes, saisie des mesures dans le détail dossier,
          catalogue et graphiques. À utiliser sur tablette ou poste au labo.
        </p>
      </header>
      <div className="hub-grid hub-grid--terrain">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="hub-card hub-card--terrain">
            <span className="hub-card-title">{c.title}</span>
            <span className="hub-card-desc">{c.desc}</span>
          </Link>
        ))}
      </div>
      <p className="hub-footnote">
        <Link to="/crm">→ Retour au CRM</Link>
      </p>
    </div>
  )
}
