import { Link } from 'react-router-dom'
import { OutlineIcon, type HubIconId } from '../../components/OutlineIcons'
import { useAuth } from '../../contexts/AuthContext'

type Card = { to: string; title: string; desc: string; icon: HubIconId }

export default function CrmHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const cards: Card[] = [
    {
      to: '/crm/documents',
      title: 'Documents commerciaux',
      desc: 'Registre devis & factures : recherche, filtres, PDF, lien vers la vue commerciale par client.',
      icon: 'documents',
    },
    {
      to: '/clients',
      title: 'Clients',
      desc: 'Fiches tiers (onglets Fiche, Commerce, Documents) ; liste avec filtres de vue et accès fiche en un clic.',
      icon: 'users',
    },
    {
      to: '/sites',
      title: 'Chantiers',
      desc: 'Liste avec filtre par client ; fiche chantier, missions, carte OSM.',
      icon: 'building',
    },
    { to: '/devis', title: 'Devis', desc: isLab ? 'Propositions commerciales.' : 'Vos devis.', icon: 'quote' },
    { to: '/invoices', title: 'Factures', desc: 'Suivi facturation et paiements.', icon: 'invoice' },
  ]

  if (isLab) {
    cards.push(
      {
        to: '/back-office/catalogue-commercial',
        title: 'Catalogue commercial',
        desc: 'Produits et prestations : PA / PV HT, TVA, stock ; alimentation des lignes de devis.',
        icon: 'catalog',
      },
      { to: '/back-office/mails', title: 'Mails', desc: 'Modèles et envois liés aux dossiers.', icon: 'mail' },
      { to: '/back-office/pdf', title: 'Création PDF', desc: 'Rapports et documents générés.', icon: 'printer' },
    )
  }

  return (
    <div className="hub-page hub-page--crm hub-page--v2">
      <header className="hub-header hub-header--v2">
        <p className="hub-kicker">Relation client</p>
        <h1>CRM — commercial & relation client</h1>
        <p className="hub-lead">
          Devis, chantiers, facturation et communications. Navigation cohérente avec l’espace terrain &
          laboratoire.
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
        <Link to="/terrain" className="hub-footnote__link">
          Passer à Terrain & laboratoire →
        </Link>
      </p>
    </div>
  )
}
