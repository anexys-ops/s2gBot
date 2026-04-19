import { Link } from 'react-router-dom'
import PageBackNav from '../components/PageBackNav'

export default function TerrainMesuresPage() {
  return (
    <div>
      <PageBackNav back={{ to: '/terrain', label: 'Terrain' }} />
      <div className="card" style={{ maxWidth: '52rem' }}>
        <h1 style={{ marginTop: 0 }}>Mesures terrain</h1>
        <p style={{ color: 'var(--color-muted)', lineHeight: 1.55 }}>
          Les formulaires de mesure sont rattachés aux dossiers <strong>commande</strong> ou <strong>chantier</strong> (préfixe
          API <code>/api/mobile/dossiers/</code> avec <code>order</code> ou <code>site</code>). Les résultats d’essais
          consolidés sont consultables côté laboratoire sous <Link to="/labo/essais">Essais &amp; graphiques</Link>.
        </p>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <Link to="/sites">Chantiers</Link> — fiches missions et forages.
          </li>
          <li>
            <Link to="/orders">Dossiers commande</Link> — lien avec le laboratoire.
          </li>
          <li>
            <Link to="/aide">Aide API (OpenAPI)</Link> — schéma des endpoints et « Try it ».
          </li>
        </ul>
      </div>
    </div>
  )
}
