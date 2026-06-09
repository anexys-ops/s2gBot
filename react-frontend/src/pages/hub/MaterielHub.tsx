import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import { MATERIEL_MODULE_TABS } from '../materiel/materielModuleTabs'

type Choice = {
  to: string
  title: string
  desc: string
  icon: HubIconId
  tone: 'equipements' | 'planning' | 'stocks'
}

const choices: Choice[] = [
  {
    to: '/materiel/equipements',
    title: 'Parc équipements',
    desc: 'Inventaire du matériel, fiches détaillées, étalonnages et alertes de calibration.',
    icon: 'calculator',
    tone: 'equipements',
  },
  {
    to: '/materiel/planning',
    title: 'Planning matériel',
    desc: 'Calendrier des échéances de maintenance, étalonnages et dates de chantiers prévues.',
    icon: 'trend',
    tone: 'planning',
  },
  {
    to: '/materiel/stocks',
    title: 'Stocks',
    desc: 'Produits, consommables et quantités suivies en stock pour le laboratoire.',
    icon: 'catalog',
    tone: 'stocks',
  },
]

export default function MaterielHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  return (
    <ModuleEntityShell
      shellClassName="module-shell--materiel-hub"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Matériel' },
      ]}
      moduleBarLabel="Matériel"
      title="Matériel et parc"
      subtitle="Inventaire, suivi d’affectation et fiches (garantie, prix, certification) — distinct du volet essais du laboratoire."
      tabs={MATERIEL_MODULE_TABS}
    >
      <div className="materiel-hub-choices" role="list">
        {choices.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className={`materiel-hub-choice materiel-hub-choice--${c.tone}`}
            role="listitem"
          >
            <span className="materiel-hub-choice__icon" aria-hidden>
              <OutlineIcon id={c.icon} />
            </span>
            <span className="materiel-hub-choice__body">
              <span className="materiel-hub-choice__title">{c.title}</span>
              <span className="materiel-hub-choice__desc">{c.desc}</span>
            </span>
            <span className="materiel-hub-choice__cta">Ouvrir →</span>
          </Link>
        ))}
      </div>

      {isLab ? (
        <p className="materiel-hub-footnote text-muted">
          Les réserves et prêts de matériel pourront compléter ce module ultérieurement.
        </p>
      ) : null}

      <div className="materiel-hub-links">
        <Link to="/labo" className="link-inline">
          Espace laboratoire (essais) →
        </Link>
        <Link to="/catalogue" className="link-inline">
          Catalogue articles →
        </Link>
      </div>
    </ModuleEntityShell>
  )
}
