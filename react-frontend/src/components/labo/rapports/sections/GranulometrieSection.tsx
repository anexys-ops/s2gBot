import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type Props = { data: Record<string, unknown> }

type TamisPoint = { tamis_mm: number; passant_pct: number }

export default function GranulometrieSection({ data }: Props) {
  const points = (Array.isArray(data.points) ? data.points : []) as TamisPoint[]
  const d10 = data.D10 as number | undefined
  const d30 = data.D30 as number | undefined
  const d60 = data.D60 as number | undefined
  const cu = d10 && d60 ? +(d60 / d10).toFixed(2) : (data.Cu as number | undefined)
  const cc =
    d10 && d30 && d60
      ? +((d30 * d30) / (d10 * d60)).toFixed(2)
      : (data.Cc as number | undefined)
  const classification = data.classification as string | undefined

  return (
    <div>
      {/* Tableau tamis */}
      {points.length > 0 && (
        <table className="rpt-table">
          <thead>
            <tr>
              <th>Tamis (mm)</th>
              <th>% Passants</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{p.tamis_mm}</td>
                <td>{p.passant_pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Courbe granulométrique */}
      {points.length > 1 && (
        <div className="rpt-chart" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="tamis_mm"
                scale="log"
                domain={['auto', 'auto']}
                type="number"
                tickFormatter={(v: number) => String(v)}
                label={{ value: 'Tamis (mm)', position: 'insideBottom', offset: -4 }}
              />
              <YAxis
                domain={[0, 100]}
                label={{ value: '% Passants', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip formatter={(v: number) => [`${v} %`, '% Passants']} />
              <Legend />
              <Line
                type="monotone"
                dataKey="passant_pct"
                name="% Passants"
                stroke="#1e40af"
                dot={{ r: 3 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Indicateurs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
        {d10 != null && (
          <span style={badgeStyle('#eff6ff', '#1e40af')}>D10 = {d10} mm</span>
        )}
        {d30 != null && (
          <span style={badgeStyle('#eff6ff', '#1e40af')}>D30 = {d30} mm</span>
        )}
        {d60 != null && (
          <span style={badgeStyle('#eff6ff', '#1e40af')}>D60 = {d60} mm</span>
        )}
        {cu != null && (
          <span style={badgeStyle('#fef9c3', '#854d0e')}>Cu = {cu}</span>
        )}
        {cc != null && (
          <span style={badgeStyle('#fef9c3', '#854d0e')}>Cc = {cc}</span>
        )}
        {classification && (
          <span style={badgeStyle('#dcfce7', '#166534')}>{classification}</span>
        )}
      </div>
    </div>
  )
}

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    padding: '0.2rem 0.6rem',
    borderRadius: 12,
    fontSize: '0.78rem',
    fontWeight: 700,
  }
}
