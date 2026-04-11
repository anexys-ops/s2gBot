import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

type Card = { to: string; title: string; desc: string }

export default function CrmHub() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  const cards: Card[] = [
    {
      to: '/crm/documents',
      title: 'Documents commerciaux',
      desc: 'Registre devis & factures : recherche, filtres, PDF, lien vers la vue commerciale par client.',
    },
    {
      to: '/clients',
      title: 'Clients',
      desc: 'Fiches tiers (onglets Fiche, Commerce, Documents) ; liste avec filtres de vue et accès fiche en un clic.',
    },
    { to: '/sites', title: 'Chantiers', desc: 'Liste avec filtre par client ; fiche chantier (barre d’actions CRUD comme sur les tiers).' },
    { to: '/devis', title: 'Devis', desc: isLab ? 'Propositions commerciales.' : 'Vos devis.' },
    { to: '/invoices', title: 'Factures', desc: 'Suivi facturation et paiements.' },
  ]

  if (isLab) {
    cards.push(
      { to: '/back-office/mails', title: 'Mails', desc: 'Modèles et envois liés aux dossiers.' },
      { to: '/back-office/pdf', title: 'Création PDF', desc: 'Rapports et documents générés.' },
    )
  }

  return (
    <div className="hub-page hub-page--crm">
      <header className="hub-header">
        <h1>CRM — commercial & relation client</h1>
        <p className="hub-lead">
          Espace dédié aux commerciaux et au suivi client : devis, chantiers, facturation et
          communications. Même compte que le reste de la plateforme.
        </p>
      </header>
      <div className="hub-grid">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="hub-card">
            <span className="hub-card-title">{c.title}</span>
            <span className="hub-card-desc">{c.desc}</span>
          </Link>
        ))}
      </div>
      <p className="hub-footnote">
        <Link to="/terrain">→ Passer à Terrain & laboratoire</Link>
      </p>
    </div>
  )
}
