import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { statsApi, type StatsEssaisParType } from '../api/client'

const ONGLETS = [
  { id: 'resume', label: 'Résumé' },
  { id: 'beton', label: 'Béton' },
  { id: 'granulats', label: 'Granulats' },
  { id: 'sols', label: 'Sols' },
  { id: 'tous', label: 'Tous les essais' },
]

const COULEURS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

function filtreParOnglet(parType: StatsEssaisParType[], ongletId: string): StatsEssaisParType[] {
  if (ongletId === 'tous' || ongletId === 'resume') return parType
  const mot = ongletId === 'beton' ? 'béton' : ongletId === 'granulats' ? 'granul' : 'sol'
  return parType.filter((t) => t.test_type_name.toLowerCase().includes(mot))
}

export default function GraphiquesEssais() {
  const [onglet, setOnglet] = useState('resume')
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats-essais'],
    queryFn: () => statsApi.essais(),
  })

  if (isLoading) return <p>Chargement des statistiques...</p>
  if (error) return <p className="error">Erreur : {String(error)}</p>

  const parType = data?.par_type ?? []
  const evolution = data?.evolution ?? []
  const recentResults = data?.recent_results ?? []
  const parTypeFiltre = filtreParOnglet(parType, onglet)

  const dataPie = parTypeFiltre.map((t, i) => ({
    name: t.test_type_name.length > 20 ? t.test_type_name.slice(0, 18) + '…' : t.test_type_name,
    value: t.count_essais,
    fill: COULEURS[i % COULEURS.length],
  })).filter((d) => d.value > 0)

  const dataEvolution = evolution.map((e) => ({ mois: e.mois, commandes: e.count }))

  return (
    <div>
      <h1>Graphiques essais</h1>
      <p style={{ color: '#64748b', marginBottom: '1rem' }}>
        Visualisation des essais par type, évolution et derniers résultats.
      </p>

      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            className="btn"
            style={{
              background: onglet === o.id ? '#2563eb' : '#f1f5f9',
              color: onglet === o.id ? '#fff' : '#334155',
            }}
            onClick={() => setOnglet(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'resume' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3>Nombre d&apos;essais par type</h3>
            {dataPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dataPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {dataPie.map((_, i) => (
                      <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p>Aucune donnée. Saisissez des résultats d&apos;essais pour voir les graphiques.</p>
            )}
          </div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3>Évolution des commandes par mois</h3>
            {dataEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dataEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="commandes" stroke="#2563eb" name="Commandes" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p>Aucune commande sur la période.</p>
            )}
          </div>
          <div className="card">
            <h3>Derniers résultats saisis</h3>
            {recentResults.length > 0 ? (
              <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Commande</th>
                      <th>Échantillon</th>
                      <th>Type d&apos;essai</th>
                      <th>Paramètre</th>
                      <th>Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentResults.slice(0, 15).map((r) => (
                      <tr key={r.id}>
                        <td>{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '-'}</td>
                        <td>{r.order_reference}</td>
                        <td>{r.sample_reference}</td>
                        <td>{r.test_type_name}</td>
                        <td>{r.param_name}</td>
                        <td>{r.value} {r.unit ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Aucun résultat encore.</p>
            )}
          </div>
        </>
      )}

      {(onglet === 'beton' || onglet === 'granulats' || onglet === 'sols') && (
        <>
          {parTypeFiltre.length === 0 ? (
            <div className="card">
              <p>Aucun essai de ce type pour l&apos;instant. Les données apparaîtront après saisie de résultats.</p>
            </div>
          ) : (
            parTypeFiltre.map((t) => (
              <div key={t.test_type_id} className="card" style={{ marginBottom: '1rem' }}>
                <h3>{t.test_type_name}</h3>
                {t.norm && <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Norme : {t.norm}</p>}
                <p>Essais : {t.count_essais} — Résultats : {t.count_resultats}</p>
                {Object.entries(t.valeurs_par_param || {}).length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4>Min / Max / Moyenne par paramètre</h4>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={Object.entries(t.valeurs_par_param).map(([param, v]) => ({
                          param: param.length > 12 ? param.slice(0, 10) + '…' : param,
                          min: v.min ?? 0,
                          max: v.max ?? 0,
                          moyenne: v.moyenne ?? 0,
                          count: v.count,
                        })).filter((d) => d.count > 0)}
                        margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="param" angle={-25} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="min" fill="#94a3b8" name="Min" />
                        <Bar dataKey="moyenne" fill="#2563eb" name="Moyenne" />
                        <Bar dataKey="max" fill="#059669" name="Max" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {t.dernieres_valeurs && t.dernieres_valeurs.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4>Dernières valeurs (série)</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={t.dernieres_valeurs.map((val, i) => ({ index: i + 1, valeur: val }))}
                        margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="index" name="N°" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="valeur" fill="#2563eb" name="Valeur" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {onglet === 'tous' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3>Essais par type (tous)</h3>
            {parTypeFiltre.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={parTypeFiltre.map((t) => ({
                    name: t.test_type_name.length > 18 ? t.test_type_name.slice(0, 16) + '…' : t.test_type_name,
                    essais: t.count_essais,
                    resultats: t.count_resultats,
                  }))}
                  margin={{ top: 10, right: 20, left: 10, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="essais" fill="#2563eb" name="Nombre d'essais" />
                  <Bar dataKey="resultats" fill="#059669" name="Résultats saisis" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p>Aucune donnée.</p>
            )}
          </div>
          <div className="card">
            <h3>Évolution des commandes par mois</h3>
            {dataEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dataEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="commandes" stroke="#2563eb" name="Commandes" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p>Aucune commande.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
