import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'
import { useAuth } from '../../contexts/AuthContext'

type Card = { to: string; title: string; desc: string; icon: HubIconId }

export default function LaboHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const cards: Card[] = [
    {
      to: '/labo/essais',
      title: 'Essais & graphiques',
      desc: 'Visualisation des séries de résultats et indicateurs d’essais.',
      icon: 'trend',
    },
    {
      to: '/orders',
      title: 'Dossiers & commandes',
      desc: 'Prélèvements, échantillons, statuts et rapports PDF.',
      icon: 'orders',
    },
    {
      to: '/orders/new',
      title: 'Nouvelle commande',
      desc: 'Créer un dossier laboratoire.',
      icon: 'plus',
    },
    ...(isLab
      ? [
          {
            to: '/back-office',
            title: 'Back office laboratoire',
            desc: 'Catalogues, modèles PDF, configuration, mails…',
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
            desc: 'Courbes tamis, indicateurs NF EN ISO 17892-4.',
            icon: 'granulo' as const,
          },
        ]),
  ]

  return (
    <div className="hub-page hub-page--terrain terrain-touch hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Laboratoire</p>
        <h1>Laboratoire</h1>
        <p className="hub-lead">
          Essais, graphiques et dossiers techniques — distinct du volet terrain (mesures et chantiers).
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
          Retour terrain →
        </Link>
      </p>
    </div>
  )
}
