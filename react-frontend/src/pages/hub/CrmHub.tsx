import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'
import { useAuth } from '../../contexts/AuthContext'

type Card = { to: string; title: string; desc: string; icon: HubIconId }

/**
 * Hub **Commercial** : devis, dossiers, pièces jointes (via dossier), factures, BC/BL.
 * Le catalogue, les clients et les chantiers ont des entrées de menu dédiées.
 */
export default function CrmHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const cards: Card[] = [
    {
      to: '/crm/documents',
      title: 'Registre documents',
      desc: 'Devis et factures : recherche, filtres, PDF, lien client.',
      icon: 'documents',
    },
    { to: '/devis', title: 'Devis', desc: isLab ? 'Propositions commerciales.' : 'Vos devis.', icon: 'quote' },
    {
      to: '/dossiers',
      title: 'Dossiers PROLAB',
      desc: 'Dossier technique : onglets devis, BC/BL, pièces, documents.',
      icon: 'orders',
    },
    { to: '/invoices', title: 'Factures', desc: 'Facturation et suivi des paiements.', icon: 'invoice' },
    {
      to: '/bons-commande',
      title: 'Bons de commande',
      desc: 'BCC, confirmation, génération de BL (actions lab).',
      icon: 'orders',
    },
    {
      to: '/bons-livraison',
      title: 'Bons de livraison',
      desc: 'BLC, quantités livrées, validation.',
      icon: 'orders',
    },
  ]

  if (isLab) {
    cards.push({
      to: '/compta-fondation',
      title: 'Compta (fondation)',
      desc: 'Règlements, situations, avoirs (lecture).',
      icon: 'invoice',
    })
  }

  return (
    <div className="hub-page hub-page--crm hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Commercial</p>
        <h1>Vente et documents</h1>
        <p className="hub-lead">
          Devis, dossiers, factures, bons de commande et de livraison. Le catalogue d’articles et l’annuaire clients
          sont dans le menu <strong>Catalogue</strong> et <strong>Clients</strong>.
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
      </div>
      <p className="hub-footnote hub-footnote--switch">
        <Link to="/catalogue" className="hub-footnote__link">
          Catalogue PROLAB
        </Link>
        {' · '}
        <Link to="/clients" className="hub-footnote__link">
          Clients
        </Link>
        {' · '}
        <Link to="/sites" className="hub-footnote__link">
          Chantiers
        </Link>
        {' · '}
        <Link to="/terrain" className="hub-footnote__link">
          Terrain
        </Link>
        {' · '}
        <Link to="/labo" className="hub-footnote__link">
          Laboratoire
        </Link>
      </p>
    </div>
  )
}
