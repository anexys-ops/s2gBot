import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'
import { useAuth } from '../../contexts/AuthContext'

type Card = { to: string; title: string; desc: string; icon: HubIconId }

/**
 * Essais, commandes lab, outils d’analyse. Le **catalogue PROLAB** est sous le menu Catalogue.
 * Le **matériel** (parc, étalonnage) est sous le menu Matériel.
 */
export default function LaboHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const cards: Card[] = [
    {
      to: '/labo/essais',
      title: 'Essais et graphiques',
      desc: 'Résultats, séries, indicateurs.',
      icon: 'trend',
    },
    {
      to: '/graphiques-essais',
      title: 'Graphiques d’essais',
      desc: 'Visualisations des séries de tests.',
      icon: 'trend',
    },
    {
      to: '/orders',
      title: 'Dossiers et commandes',
      desc: 'Prélèvements, échantillons, statuts, rapports PDF.',
      icon: 'orders',
    },
    {
      to: '/orders/new',
      title: 'Nouvelle commande',
      desc: 'Créer un dossier de commande laboratoire.',
      icon: 'plus',
    },
  ]

  if (isLab) {
    cards.push(
      { to: '/back-office/granulometrie', title: 'Granulométrie', desc: 'NF EN ISO 17892-4, courbes.', icon: 'granulo' },
      { to: '/back-office/cadrage', title: 'Cadrage', desc: 'Données de cadrage laboratoire.', icon: 'lab' },
    )
  } else {
    cards.push(
      { to: '/back-office/granulometrie', title: 'Granulométrie', desc: 'Courbes et tamis.', icon: 'granulo' },
    )
  }

  return (
    <div className="hub-page hub-page--terrain terrain-touch hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Laboratoire</p>
        <h1>Laboratoire</h1>
        <p className="hub-lead">
          Commandes d’essai, analyses et outils. Le catalogue PROLAB est dans le menu <strong>Catalogue</strong> ; le
          parc matériel est dans le menu <strong>Matériel</strong>.
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
        <Link to="/terrain" className="hub-footnote__link">
          Terrain (chantier) →
        </Link>
        {' · '}
        <Link to="/materiel" className="hub-footnote__link">
          Matériel →
        </Link>
      </p>
    </div>
  )
}
