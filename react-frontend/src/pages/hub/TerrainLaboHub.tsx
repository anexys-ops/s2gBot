import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'
import { useAuth } from '../../contexts/AuthContext'

type Card = { to: string; title: string; desc: string; icon: HubIconId }

export default function TerrainLaboHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const cards: Card[] = [
    {
      to: '/orders',
      title: 'Commandes & dossiers',
      desc: 'Liste des dossiers : prélèvements, échantillons, statuts.',
      icon: 'orders',
    },
    {
      to: '/orders/new',
      title: 'Nouvelle commande',
      desc: 'Créer un dossier depuis le terrain ou le labo.',
      icon: 'plus',
    },
    ...(isLab
      ? [
          {
            to: '/back-office',
            title: 'Back office',
            desc: 'Catalogues (essais, commercial) et outils labo : granulométrie, audit, PDF, configuration…',
            icon: 'lab' as const,
          },
        ]
      : [
          {
            to: '/back-office/catalogue-essais',
            title: 'Catalogue des essais',
            desc: 'Types d’essais, normes et paramètres.',
            icon: 'catalog' as const,
          },
          {
            to: '/back-office/granulometrie',
            title: 'Granulométrie',
            desc: 'Courbe tamis, D10 / D60, Cu et Cc (NF EN ISO 17892-4).',
            icon: 'granulo' as const,
          },
        ]),
    {
      to: '/graphiques-essais',
      title: 'Graphiques essais',
      desc: 'Visualisation des séries de résultats.',
      icon: 'trend',
    },
    {
      to: '/sites',
      title: 'Chantiers & carte',
      desc: 'Missions, forages, lithologie ; onglet Carte (OSM) sur chaque chantier.',
      icon: 'map',
    },
  ]

  return (
    <div className="hub-page hub-page--terrain terrain-touch hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Espace terrain & laboratoire</p>
        <h1>Terrain & laboratoire</h1>
        <p className="hub-lead">
          Commandes, essais, cartographie chantier et calculs normés. Installable en PWA pour un usage
          tablette ; mode hors ligne expérimental avec file d’attente locale.
        </p>
      </header>
      <div className="hub-grid hub-grid--terrain hub-grid--v2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="hub-card hub-card--terrain hub-card--v2">
            <span className="hub-card-v2__icon" aria-hidden>
              <OutlineIcon id={c.icon} />
            </span>
            <span className="hub-card-title">{c.title}</span>
            <span className="hub-card-desc">{c.desc}</span>
          </Link>
        ))}
      </div>
      <p className="hub-footnote hub-footnote--switch">
        <Link to="/crm" className="hub-footnote__link">
          Retour au CRM →
        </Link>
      </p>
    </div>
  )
}
