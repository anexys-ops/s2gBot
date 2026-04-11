import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const RAPPORTS_LINKS = [
  { to: '/rapports/compta', label: 'Compta' },
  { to: '/rapports/ventes', label: 'Ventes' },
  { to: '/rapports/delai-traitement', label: 'Délais traitement' },
  { to: '/rapports/delai-chantier', label: 'Délais chantier' },
] as const

const COMMERCE_LINKS = [
  { to: '/devis', label: 'Devis' },
  { to: '/invoices', label: 'Factures' },
  { to: '/crm/documents', label: 'Documents CRM' },
  { to: '/graphiques-essais', label: 'Graphiques essais' },
] as const

/**
 * Barre toujours visible sous l’en-tête : retour historique, accueil, accès rapides métier.
 */
export default function AppContextBar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [rapportsOpen, setRapportsOpen] = useState(false)
  const [commerceOpen, setCommerceOpen] = useState(false)
  const rapportsRef = useRef<HTMLDivElement>(null)
  const commerceRef = useRef<HTMLDivElement>(null)

  const goBack = () => {
    navigate(-1)
  }

  useEffect(() => {
    if (!rapportsOpen && !commerceOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rapportsOpen && rapportsRef.current && !rapportsRef.current.contains(t)) setRapportsOpen(false)
      if (commerceOpen && commerceRef.current && !commerceRef.current.contains(t)) setCommerceOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRapportsOpen(false)
        setCommerceOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [rapportsOpen, commerceOpen])

  return (
    <div className="app-context-bar" role="navigation" aria-label="Navigation contextuelle">
      <div className="app-context-bar__inner">
        <div className="app-context-bar__primary">
          <button type="button" className="app-context-bar__btn" onClick={goBack}>
            ← Retour
          </button>
          <Link to="/" className="app-context-bar__btn app-context-bar__link">
            Accueil
          </Link>
        </div>
        <span className="app-context-bar__sep" aria-hidden />
        <div className="app-context-bar__menus">
          <Link to="/crm" className="app-context-bar__link app-context-bar__pill">
            CRM
          </Link>
          <Link to="/terrain" className="app-context-bar__link app-context-bar__pill">
            Terrain & labo
          </Link>
          {isLab ? (
            <Link to="/back-office" className="app-context-bar__link app-context-bar__pill">
              Back office
            </Link>
          ) : null}
          <div className="app-context-bar__dropdown" ref={commerceRef}>
            <button
              type="button"
              className="app-context-bar__dropdown-trigger"
              aria-expanded={commerceOpen}
              aria-haspopup="true"
              onClick={() => {
                setCommerceOpen((v) => !v)
                setRapportsOpen(false)
              }}
            >
              Commerce <span className="app-context-bar__caret" aria-hidden />
            </button>
            {commerceOpen ? (
              <div className="app-context-bar__dropdown-panel" role="menu">
                {COMMERCE_LINKS.map((x) => (
                  <Link
                    key={x.to}
                    to={x.to}
                    className="app-context-bar__dropdown-item"
                    role="menuitem"
                    onClick={() => setCommerceOpen(false)}
                  >
                    {x.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="app-context-bar__dropdown" ref={rapportsRef}>
            <button
              type="button"
              className="app-context-bar__dropdown-trigger"
              aria-expanded={rapportsOpen}
              aria-haspopup="true"
              onClick={() => {
                setRapportsOpen((v) => !v)
                setCommerceOpen(false)
              }}
            >
              Rapports <span className="app-context-bar__caret" aria-hidden />
            </button>
            {rapportsOpen ? (
              <div className="app-context-bar__dropdown-panel" role="menu">
                {RAPPORTS_LINKS.map((x) => (
                  <Link
                    key={x.to}
                    to={x.to}
                    className="app-context-bar__dropdown-item"
                    role="menuitem"
                    onClick={() => setRapportsOpen(false)}
                  >
                    {x.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
