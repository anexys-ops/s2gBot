import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

type Props = { data: Record<string, unknown> }

type ProctorPoint = { w_pct: number; gamma_d: number }

export default function ProctorSection({ data }: Props) {
  const points = (Array.isArray(data.points) ? data.points : []) as ProctorPoint[]
  const opm_w = data.opm_w as number | undefined
  const opm_gamma_d = data.opm_gamma_d as number | undefined

  return (
    <div>
      <table className="rpt-table">
        <thead>
          <tr>
            <th>w (%)</th>
            <th>γd (g/cm³)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.w_pct}</td>
              <td>{p.gamma_d}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {points.length > 1 && (
        <div className="rpt-chart" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="w_pct"
                label={{ value: 'w (%)', position: 'insideBottom', offset: -4 }}
              />
              <YAxis
                label={{ value: 'γd (g/cm³)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="gamma_d"
                name="γd (g/cm³)"
                stroke="#1e40af"
                dot={{ r: 4 }}
                strokeWidth={2}
              />
              {opm_w != null && (
                <ReferenceLine
                  x={opm_w}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  label={{ value: 'OPM', position: 'top', fill: '#ef4444', fontSize: 11 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(opm_w != null || opm_gamma_d != null) && (
        <div
          style={{
            display: 'inline-flex',
            gap: '1.5rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '0.6rem 1.2rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: '#991b1b',
          }}
        >
          {opm_gamma_d != null && <span>γdmax = {opm_gamma_d} g/cm³</span>}
          {opm_w != null && <span>w_OPM = {opm_w} %</span>}
        </div>
      )}
    </div>
  )
}
