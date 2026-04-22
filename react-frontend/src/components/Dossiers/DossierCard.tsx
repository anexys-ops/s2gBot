import { Link } from 'react-router-dom'
import type { DossierRow } from '../../api/client'

type Props = { row: DossierRow; clientName?: string }

const BADGE: Record<string, string> = {
  brouillon: 'dossier-badge dossier-badge--brouillon',
  en_cours: 'dossier-badge dossier-badge--cours',
  cloture: 'dossier-badge dossier-badge--cloture',
  archive: 'dossier-badge dossier-badge--archive',
}

export default function DossierCard({ row, clientName }: Props) {
  return (
    <article className="dossier-card card" style={{ padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <code style={{ fontSize: '0.9rem' }}>{row.reference}</code>
          <h3 className="dossier-card__title" style={{ margin: '0.2rem 0 0', fontSize: '1.05rem' }}>
            {row.titre}
          </h3>
        </div>
        <span className={BADGE[row.statut] ?? 'dossier-badge'}>{row.statut}</span>
      </div>
      <p className="text-muted" style={{ fontSize: '0.88rem', margin: '0.4rem 0' }}>
        {clientName ?? row.client?.name ?? 'Client #'.concat(String(row.client_id))}
        {' — '}
        {row.site?.name ?? 'Chantier #'.concat(String(row.site_id))}
      </p>
      <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
        Début : {row.date_debut?.slice(0, 10) ?? '—'}
      </p>
      <div style={{ marginTop: '0.65rem' }}>
        <Link to={`/dossiers/${row.id}`} className="link-inline">
          Fiche →
        </Link>
      </div>
    </article>
  )
}
