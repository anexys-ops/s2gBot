/**
 * Jalons réceptionnés — vue du responsable laboratoire : uniquement les jalons dont au moins
 * un échantillon est arrivé au labo (client, chantier, jalon, n° PV, n° de réception).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { labReceptionApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import ListTableToolbar from '../../components/ListTableToolbar'
import { ListTablePanelHeader } from '../../components/ListTablePanel'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { formatAppDate } from '../../lib/appLocale'

const STATUS_OPTIONS = [
  { value: 'a_traiter', label: 'Échantillons à traiter' },
  { value: 'tous', label: 'Tous les jalons réceptionnés' },
]

function CodeList({ values }: { values: string[] }) {
  if (values.length === 0) return <>—</>
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem' }}>
      {values.map((v) => (
        <code key={v} className="code-badge">{v}</code>
      ))}
    </span>
  )
}

export default function LaboJalonsRecusPage() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('a_traiter')

  const { data, isLoading, error } = useQuery({
    queryKey: ['lab-jalons-recus', debouncedSearch],
    queryFn: () => labReceptionApi.jalonsRecus({ search: debouncedSearch.trim() || undefined }),
    placeholderData: keepPreviousData,
  })

  const rows = useMemo(
    () => (data?.data ?? []).filter((r) => statusFilter === 'tous' || r.echantillons_a_traiter > 0),
    [data, statusFilter],
  )

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Laboratoire', to: '/labo' },
        { label: 'Jalons réceptionnés' },
      ]}
      moduleBarLabel="Laboratoire — Jalons réceptionnés"
      title="Jalons réceptionnés"
      subtitle={
        data
          ? `${data.stats.jalons_a_traiter} jalon(s) avec ${data.stats.echantillons_a_traiter} échantillon(s) à traiter · ${data.stats.jalons} jalon(s) réceptionné(s) au total.`
          : 'Jalons dont la réception laboratoire est effectuée.'
      }
    >
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Client, chantier, jalon, n° PV, n° de réception…"
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={STATUS_OPTIONS}
      />

      <div className="card dossier-tab-panel dossier-tab-panel--table">
        <ListTablePanelHeader title="Jalons" count={rows.length} />
        {error ? (
          <p className="error" style={{ padding: '1rem' }}>{error instanceof Error ? error.message : 'Erreur de chargement.'}</p>
        ) : isLoading ? (
          <p className="text-muted" style={{ padding: '1rem' }}>Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted" style={{ padding: '1rem' }}>
            {statusFilter === 'a_traiter' ? 'Aucun jalon réceptionné en attente de traitement.' : 'Aucun jalon réceptionné.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Chantier</th>
                  <th>Jalon</th>
                  <th>Numéro PV</th>
                  <th>Numéro de réception</th>
                  <th className="data-table__num">Échantillons</th>
                  <th>Dernière réception</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.client?.name ?? '—'}</td>
                    <td>{r.chantier?.name ?? '—'}</td>
                    <td>
                      <strong>{r.libelle}</strong>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {r.dossier?.reference ?? ''}
                        {r.dossier ? ' · ' : ''}
                        <Link to={`/bons-commande/${r.bon_commande.id}`} className="link-inline">{r.bon_commande.numero}</Link>
                      </div>
                    </td>
                    <td><CodeList values={r.pv_numbers} /></td>
                    <td><CodeList values={r.numeros_reception} /></td>
                    <td className="data-table__num">
                      {r.echantillons_a_traiter > 0 ? `${r.echantillons_a_traiter} à traiter / ` : ''}
                      {r.echantillons_recus} reçu{r.echantillons_recus > 1 ? 's' : ''}
                    </td>
                    <td>{r.derniere_reception_at ? formatAppDate(r.derniere_reception_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModuleEntityShell>
  )
}
