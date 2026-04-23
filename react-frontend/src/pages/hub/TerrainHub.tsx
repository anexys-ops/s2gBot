import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'

type Card = { to: string; title: string; desc: string; icon: HubIconId }

const cards: Card[] = [
  {
    to: '/sites',
    title: 'Chantiers',
    desc: 'Liste des chantiers par client, fiche, missions, carte embarquée.',
    icon: 'building',
  },
  {
    to: '/terrain/mesures',
    title: 'Mesures terrain',
    desc: 'Formulaires, dossiers liés, synthèses.',
    icon: 'trend',
  },
  {
    to: '/terrain/chantiers',
    title: 'Chantiers et carte GPS',
    desc: 'Carte des points géolocalisés (coordonnées renseignées).',
    icon: 'map',
  },
  {
    to: '/terrain/planning',
    title: 'Planning techniciens',
    desc: 'Sorties, retours et temps sur chantier (calendrier — évolution).',
    icon: 'trend',
  },
]

export default function TerrainHub() {
  return (
    <div className="hub-page hub-page--terrain terrain-touch hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Chantier</p>
        <h1>Chantier et terrain</h1>
        <p className="hub-lead">
          Chantiers, relevés et cartographie — regroupé avec le fil terrain (hors espace essais / laboratoire).
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
        <Link to="/labo" className="hub-footnote__link">
          Espace laboratoire (essais) →
        </Link>
        {' · '}
        <Link to="/materiel" className="hub-footnote__link">
          Matériel →
        </Link>
      </p>
    </div>
  )
}
