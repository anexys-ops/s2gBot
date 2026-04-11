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
import { pdfApi, statsApi, type StatsEssaisParType } from '../api/client'
const ONGLETS = [
  { id: 'resume', label: 'Résumé' },
  { id: 'exemples', label: 'Exemples (courbes + PDF)' },
  { id: 'beton', label: 'Béton' },
  { id: 'granulats', label: 'Granulats' },
  { id: 'sols', label: 'Sols' },
  { id: 'tous', label: 'Tous les essais' },
]

/** Mêmes points que l’API `ExamplePdfController` (PDF téléchargeable identique au schéma). */
const EXEMPLE_COMPRESSION = [
  { palier: 0, sigma: 0 },
  { palier: 1, sigma: 8.2 },
  { palier: 2, sigma: 16.5 },
  { palier: 3, sigma: 24.1 },
  { palier: 4, sigma: 30.8 },
  { palier: 5, sigma: 35.2 },
  { palier: 6, sigma: 37.9 },
  { palier: 7, sigma: 39.1 },
  { palier: 8, sigma: 39.6 },
]

const EXEMPLE_GRANULO = [
  { tamis: '16 mm', passant: 100 },
  { tamis: '8 mm', passant: 92 },
  { tamis: '4 mm', passant: 78 },
  { tamis: '2 mm', passant: 58 },
  { tamis: '1 mm', passant: 38 },
  { tamis: '0,5 mm', passant: 22 },
  { tamis: '0,25 mm', passant: 12 },
  { tamis: '0,125 mm', passant: 5 },
  { tamis: '0,063 mm', passant: 1.5 },
]

const EXEMPLE_SYNTHESE_ROWS = [
  { essai: 'Compression béton C25/30', norme: 'NF EN 12390-3', resultat: 'Rc = 38,2 MPa', conformite: 'Conforme' },
  { essai: 'Module de finesse', norme: 'NF EN 933-1', resultat: 'MF = 3,25', conformite: 'Conforme' },
  { essai: 'Teneur en eau', norme: 'NF EN ISO 17892-1', resultat: 'W = 14,8 %', conformite: 'Conforme' },
  { essai: 'CBR à 2,5 mm', norme: 'NF EN 13286-47', resultat: 'CBR = 42 %', conformite: 'Conforme' },
]

const COULEURS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

function filtreParOnglet(parType: StatsEssaisParType[], ongletId: string): StatsEssaisParType[] {
  if (ongletId === 'tous' || ongletId === 'resume') return parType
  const mot = ongletId === 'beton' ? 'béton' : ongletId === 'granulats' ? 'granul' : 'sol'
  return parType.filter((t) => t.test_type_name.toLowerCase().includes(mot))
}

export default function GraphiquesEssais() {
  const [onglet, setOnglet] = useState('resume')
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
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

      {onglet === 'exemples' && (
        <>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Données fictives à visée pédagogique. Les PDF reprennent les mêmes jeux de valeurs.
          </p>
          {pdfErr && <p className="error" style={{ marginBottom: '0.75rem' }}>{pdfErr}</p>}

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Courbe type — compression béton (σ en MPa)</h3>
              <button
                type="button"
                className="btn"
                disabled={!!pdfLoading}
                onClick={async () => {
                  setPdfErr(null)
                  setPdfLoading('compression')
                  try {
                    await pdfApi.downloadExample('compression')
                  } catch (e) {
                    setPdfErr(String(e instanceof Error ? e.message : e))
                  } finally {
                    setPdfLoading(null)
                  }
                }}
              >
                {pdfLoading === 'compression' ? 'Téléchargement…' : 'Télécharger le PDF'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={EXEMPLE_COMPRESSION} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="palier" name="Palier" label={{ value: 'Palier de charge', position: 'insideBottom', offset: -4 }} />
                <YAxis label={{ value: 'σ (MPa)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(v: number) => [`${v} MPa`, 'Contrainte']} />
                <Legend />
                <Line type="monotone" dataKey="sigma" stroke="#2563eb" strokeWidth={2} dot name="σ (MPa)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Courbe granulométrique — % passant cumulé</h3>
              <button
                type="button"
                className="btn"
                disabled={!!pdfLoading}
                onClick={async () => {
                  setPdfErr(null)
                  setPdfLoading('granulometrie')
                  try {
                    await pdfApi.downloadExample('granulometrie')
                  } catch (e) {
                    setPdfErr(String(e instanceof Error ? e.message : e))
                  } finally {
                    setPdfLoading(null)
                  }
                }}
              >
                {pdfLoading === 'granulometrie' ? 'Téléchargement…' : 'Télécharger le PDF'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={EXEMPLE_GRANULO} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tamis" angle={-30} textAnchor="end" height={56} interval={0} fontSize={11} />
                <YAxis domain={[0, 100]} label={{ value: '% passant', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(v: number) => [`${v} %`, 'Passant']} />
                <Legend />
                <Line type="monotone" dataKey="passant" stroke="#059669" strokeWidth={2} dot name="% passant" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Synthèse d&apos;essais (aperçu)</h3>
              <button
                type="button"
                className="btn"
                disabled={!!pdfLoading}
                onClick={async () => {
                  setPdfErr(null)
                  setPdfLoading('synthese')
                  try {
                    await pdfApi.downloadExample('synthese-essais')
                  } catch (e) {
                    setPdfErr(String(e instanceof Error ? e.message : e))
                  } finally {
                    setPdfLoading(null)
                  }
                }}
              >
                {pdfLoading === 'synthese' ? 'Téléchargement…' : 'Télécharger le PDF'}
              </button>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Tableau récapitulatif type rapport ; le PDF reprend la mise en page complète.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Essai</th>
                    <th>Norme</th>
                    <th>Résultat</th>
                    <th>Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {EXEMPLE_SYNTHESE_ROWS.map((row) => (
                    <tr key={row.essai}>
                      <td>{row.essai}</td>
                      <td>{row.norme}</td>
                      <td>{row.resultat}</td>
                      <td>{row.conformite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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
                    label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${value ?? ''}`}
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
