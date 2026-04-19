import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'

type Card = { to: string; title: string; desc: string; icon: HubIconId }

const cards: Card[] = [
  {
    to: '/terrain/mesures',
    title: 'Mesures terrain',
    desc: 'Formulaires mobiles, suivi des dossiers liés aux chantiers et synthèses.',
    icon: 'trend',
  },
  {
    to: '/terrain/chantiers',
    title: 'Chantiers & carte GPS',
    desc: 'Liste des chantiers et carte des points géolocalisés (coordonnées renseignées).',
    icon: 'map',
  },
]

export default function TerrainHub() {
  return (
    <div className="hub-page hub-page--terrain terrain-touch hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Terrain</p>
        <h1>Terrain</h1>
        <p className="hub-lead">
          Mesures sur le terrain et chantiers géolocalisés — séparé du volet laboratoire (essais &amp; dossiers).
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
          Espace laboratoire (essais &amp; dossiers) →
        </Link>
      </p>
    </div>
  )
}
