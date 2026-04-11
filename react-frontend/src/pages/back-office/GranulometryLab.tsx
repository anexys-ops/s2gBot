import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { btpCalculationsApi, type GranulometryResult } from '../../api/client'

const DEFAULT_ROWS = [
  { opening_mm: '0.063', passing_percent: '5' },
  { opening_mm: '0.1', passing_percent: '12' },
  { opening_mm: '0.25', passing_percent: '28' },
  { opening_mm: '0.5', passing_percent: '45' },
  { opening_mm: '1', passing_percent: '62' },
  { opening_mm: '2', passing_percent: '78' },
  { opening_mm: '6.3', passing_percent: '92' },
]

type Row = { opening_mm: string; passing_percent: string }

export default function GranulometryLab() {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS)
  const [result, setResult] = useState<GranulometryResult | null>(null)

  const mut = useMutation({
    mutationFn: () => {
      const points = rows
        .map((r) => ({
          opening_mm: Number(String(r.opening_mm).replace(',', '.')),
          passing_percent: Number(String(r.passing_percent).replace(',', '.')),
        }))
        .filter((p) => p.opening_mm > 0 && Number.isFinite(p.passing_percent))
      return btpCalculationsApi.granulometry(points)
    },
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  })

  const chartData = useMemo(() => {
    return rows
      .map((r) => ({
        opening: Number(String(r.opening_mm).replace(',', '.')),
        passing: Number(String(r.passing_percent).replace(',', '.')),
      }))
      .filter((d) => d.opening > 0 && Number.isFinite(d.passing))
      .sort((a, b) => a.opening - b.opening)
      .map((d) => ({
        label: `${d.opening} mm`,
        passant: d.passing,
      }))
  }, [rows])

  return (
    <div className="design-stack">
        <div className="design-card">
          <h3 className="design-card__title">Saisie % passants cumulés</h3>
          <p className="design-card__muted">
            Une ligne par tamis : ouverture en mm et % passant cumulé. Triez par ouverture croissante en pratique.
          </p>
          <div className="granulo-table-wrap">
            <table className="granulo-table">
              <thead>
                <tr>
                  <th>Ouverture (mm)</th>
                  <th>% passant cumulé</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className="granulo-table__input"
                        value={r.opening_mm}
                        onChange={(e) => {
                          const next = [...rows]
                          next[i] = { ...next[i], opening_mm: e.target.value }
                          setRows(next)
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="granulo-table__input"
                        value={r.passing_percent}
                        onChange={(e) => {
                          const next = [...rows]
                          next[i] = { ...next[i], passing_percent: e.target.value }
                          setRows(next)
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="crud-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows((r) => [...r, { opening_mm: '', passing_percent: '' }])}>
              + Ligne
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={mut.isPending}
              onClick={() => mut.mutate()}
            >
              Calculer D10 / D60 / Cu / Cc
            </button>
          </div>
          {mut.isError && <p className="error">{(mut.error as Error).message}</p>}
        </div>

        {result && (
          <div className="design-card design-card--accent">
            <h3 className="design-card__title">Résultats</h3>
            <dl className="granulo-kpis">
              <div>
                <dt>D₁₀</dt>
                <dd>{result.d10 != null ? `${result.d10} mm` : '—'}</dd>
              </div>
              <div>
                <dt>D₃₀</dt>
                <dd>{result.d30 != null ? `${result.d30} mm` : '—'}</dd>
              </div>
              <div>
                <dt>D₆₀</dt>
                <dd>{result.d60 != null ? `${result.d60} mm` : '—'}</dd>
              </div>
              <div>
                <dt>Cu</dt>
                <dd>{result.cu ?? '—'}</dd>
              </div>
              <div>
                <dt>Cc</dt>
                <dd>{result.cc ?? '—'}</dd>
              </div>
            </dl>
          </div>
        )}

        {chartData.length >= 2 && (
          <div className="design-card">
            <h3 className="design-card__title">Courbe (aperçu)</h3>
            <div className="granulo-chart-box">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={40} label={{ value: '% passant', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(v: number) => [`${v} %`, 'Passant']} />
                  <Line type="monotone" dataKey="passant" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="% passant" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
  )
}
