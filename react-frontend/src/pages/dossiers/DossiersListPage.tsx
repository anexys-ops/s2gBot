import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clientsApi, dossiersApi, type DossierStatut } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import DossierCard from '../../components/Dossiers/DossierCard'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

const STATUTS: { v: DossierStatut | ''; l: string }[] = [
  { v: '', l: 'Tous les statuts' },
  { v: 'brouillon', l: 'Brouillon' },
  { v: 'en_cours', l: 'En cours' },
  { v: 'cloture', l: 'Clôturé' },
  { v: 'archive', l: 'Archivé' },
]

export default function DossiersListPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const [clientId, setClientId] = useState<number | ''>('')
  const [statut, setStatut] = useState<DossierStatut | ''>('')
  const [dateDebutFrom, setDateDebutFrom] = useState('')
  const [dateDebutTo, setDateDebutTo] = useState('')

  const { data: clients } = useQuery({
    queryKey: ['clients', 'dossiers-filter'],
    queryFn: () => clientsApi.list(),
    enabled: isLab,
  })

  const { data: dossiers, isLoading, error } = useQuery({
    queryKey: ['dossiers', clientId, statut, dateDebutFrom, dateDebutTo],
    queryFn: () =>
      dossiersApi.list({
        ...(clientId !== '' ? { client_id: clientId } : {}),
        ...(statut !== '' ? { statut } : {}),
        ...(dateDebutFrom ? { date_debut_from: dateDebutFrom } : {}),
        ...(dateDebutTo ? { date_debut_to: dateDebutTo } : {}),
      }),
  })

  const clientMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of clients ?? []) {
      m.set(c.id, c.name)
    }
    return m
  }, [clients])

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'CRM', to: '/crm' },
        { label: 'Dossiers chantier' },
      ]}
      moduleBarLabel="CRM — Dossiers chantier"
      title="Dossiers chantier (PROLAB)"
      subtitle="Dossiers techniques BTP rattachés à un client et un chantier, avec référence de type DOS-ANNEE-SEQUENCE."
      actions={
        isLab ? (
          <Link to="/dossiers/new" className="btn btn-primary btn-sm">
            Nouveau dossier
          </Link>
        ) : null
      }
    >
      {isLab && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'flex-end',
          }}
        >
          <label className="form-label" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              Client
            </span>
            <select
              className="form-control"
              value={clientId === '' ? '' : String(clientId)}
              onChange={(e) => setClientId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Tous</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              Statut
            </span>
            <select
              className="form-control"
              value={statut}
              onChange={(e) => setStatut((e.target.value || '') as DossierStatut | '')}
            >
              {STATUTS.map((o) => (
                <option key={o.l} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              Période (début ≥)
            </span>
            <input
              type="date"
              className="form-control"
              value={dateDebutFrom}
              onChange={(e) => setDateDebutFrom(e.target.value)}
            />
          </label>
          <label className="form-label" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              Période (début ≤)
            </span>
            <input
              type="date"
              className="form-control"
              value={dateDebutTo}
              onChange={(e) => setDateDebutTo(e.target.value)}
            />
          </label>
        </div>
      )}

      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      {dossiers && (
        <div className="dossiers-grid--cards">
          {dossiers.map((d) => (
            <DossierCard key={d.id} row={d} clientName={clientMap.get(d.client_id)} />
          ))}
        </div>
      )}

      {dossiers && (
        <div className="table-wrap dossiers-table-desktop">
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Titre</th>
                <th>Client</th>
                <th>Chantier</th>
                <th>Statut</th>
                <th>Début</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr key={d.id}>
                  <td>
                    <code>{d.reference}</code>
                  </td>
                  <td>{d.titre}</td>
                  <td>{d.client?.name ?? clientMap.get(d.client_id) ?? `#${d.client_id}`}</td>
                  <td>{d.site?.name ?? `Chantier #${d.site_id}`}</td>
                  <td>{d.statut}</td>
                  <td>{d.date_debut?.slice(0, 10)}</td>
                  <td>
                    <Link to={`/dossiers/${d.id}`} className="link-inline">
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dossiers && dossiers.length === 0 && <p className="text-muted">Aucun dossier pour ces filtres.</p>}
    </ModuleEntityShell>
  )
}
