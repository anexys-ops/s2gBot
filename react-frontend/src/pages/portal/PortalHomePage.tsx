import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  effectivePortalModules,
  PORTAL_MODULE_LABELS,
  type PortalModuleKey,
} from '../../lib/portalAccess'

const MODULE_CARDS: { key: PortalModuleKey; to: string; hint: string }[] = [
  { key: 'dossiers', to: '/portal/dossiers', hint: 'Consultez vos affaires et chantiers.' },
  { key: 'interventions', to: '/portal/interventions', hint: 'Interventions planifiées ou en cours sur vos sites.' },
  { key: 'rapports', to: '/portal/rapports', hint: 'Téléchargez les rapports d\'essais signés ou émis.' },
  { key: 'devis', to: '/portal/devis', hint: 'Vos propositions commerciales.' },
  { key: 'factures', to: '/portal/factures', hint: 'Vos factures et documents comptables.' },
  { key: 'documents', to: '/portal/dossiers', hint: 'Documents partagés dans vos dossiers.' },
]

export default function PortalHomePage() {
  const { user } = useAuth()
  const modules = effectivePortalModules(user)

  const cards = MODULE_CARDS.filter((c) => modules.includes(c.key))

  return (
    <div className="portal-home">
      <header className="portal-home__header">
        <h1>Bienvenue{user?.name ? `, ${user.name}` : ''}</h1>
        <p className="text-muted">
          Espace dédié {user?.client?.name ? `à ${user.client.name}` : 'client'}
          {user?.site?.name ? ` — chantier ${user.site.name}` : ''}.
          Seuls les modules activés par votre laboratoire sont visibles ci-dessous.
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="card" style={{ padding: '1.5rem' }}>
          <p className="text-muted">Aucun module portail n&apos;est activé pour votre compte. Contactez le laboratoire.</p>
        </div>
      ) : (
        <div className="portal-home__grid">
          {cards.map((card) => (
            <Link key={card.key} to={card.to} className="portal-home__card">
              <h2>{PORTAL_MODULE_LABELS[card.key]}</h2>
              <p>{card.hint}</p>
              <span className="portal-home__card-cta">Ouvrir →</span>
            </Link>
          ))}
        </div>
      )}

      <section className="portal-home__modules card" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Modules activés</h3>
        <ul className="portal-home__module-list">
          {modules.map((m) => (
            <li key={m}>
              <span className="portal-home__module-dot" aria-hidden />
              {PORTAL_MODULE_LABELS[m]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
