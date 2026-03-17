import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div>
      <h1>Bienvenue, {user?.name}</h1>
      <p>Plateforme essais laboratoire BTP.</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/orders" className="btn btn-primary">
          Voir les commandes
        </Link>
        <Link to="/catalog" className="btn btn-secondary">
          Catalogue des essais
        </Link>
        <Link to="/invoices" className="btn btn-secondary">
          Factures
        </Link>
      </div>
    </div>
  )
}
