import { Link } from 'react-router-dom'
import { OutlineIcon } from '../../components/OutlineIcons'
import { useAuth } from '../../contexts/AuthContext'

const cards = [
  {
    to: '/back-office/equipements',
    title: 'Parc équipements',
    desc: 'Liste du matériel, étalonnages, fiches détaillées et alertes de calibration.',
    icon: 'calculator' as const,
  },
] as const

export default function MaterielHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  return (
    <div className="hub-page hub-page--terrain hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Matériel</p>
        <h1>Matériel et parc</h1>
        <p className="hub-lead">
          Inventaire, suivi d’affectation et fiches (garantie, prix, certification) — point d’entrée unique pour
          l’équipement, distinct du volet essais du laboratoire.
        </p>
      </header>
      <div className="hub-grid hub-grid--v2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="hub-card hub-card--v2">
            <span className="hub-card-v2__icon" aria-hidden>
              <OutlineIcon id={c.icon} />
            </span>
            <span className="hub-card-title">{c.title}</span>
            <span className="hub-card-desc">{c.desc}</span>
          </Link>
        ))}
        <div
          className="hub-card hub-card--v2"
          style={{ borderStyle: 'dashed', opacity: 0.92, cursor: 'default' }}
        >
          <span className="hub-card-v2__icon" aria-hidden>
            <OutlineIcon id="trend" />
          </span>
          <span className="hub-card-title">Inventaire et localisation</span>
          <span className="hub-card-desc">Vue stock / prêt de matériel par mission — à connecter (spec §8).</span>
        </div>
      </div>
      {isLab && (
        <p className="hub-footnote text-muted" style={{ marginTop: '1.25rem' }}>
          Réserves / prêts de matériel pourront compléter cette entrée.
        </p>
      )}
      <p className="hub-footnote hub-footnote--switch">
        <Link to="/labo" className="hub-footnote__link">
          Espace laboratoire (essais) →
        </Link>
      </p>
    </div>
  )
}
