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

type PenetrationPoint = { penetration_mm: number; charge_kn: number }

export default function CbrSection({ data }: Props) {
  const points = (Array.isArray(data.points) ? data.points : []) as PenetrationPoint[]
  const cbr_25 = data.cbr_25 as number | undefined
  const cbr_5 = data.cbr_5 as number | undefined
  const cbr_retenu = data.cbr_retenu as number | undefined

  const isBad = cbr_retenu != null && cbr_retenu < 3

  return (
    <div>
      <table className="rpt-table">
        <thead>
          <tr>
            <th>Pénétration (mm)</th>
            <th>Charge (kN)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.penetration_mm}</td>
              <td>{p.charge_kn}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {points.length > 1 && (
        <div className="rpt-chart" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="penetration_mm"
                label={{ value: 'Pénétration (mm)', position: 'insideBottom', offset: -4 }}
              />
              <YAxis
                label={{ value: 'Charge (kN)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="charge_kn"
                name="Charge (kN)"
                stroke="#1e40af"
                dot={{ r: 3 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
        {cbr_25 != null && (
          <span style={badge('#eff6ff', '#1e40af')}>CBR 2,5 mm = {cbr_25} %</span>
        )}
        {cbr_5 != null && (
          <span style={badge('#eff6ff', '#1e40af')}>CBR 5 mm = {cbr_5} %</span>
        )}
        {cbr_retenu != null && (
          <span style={badge(isBad ? '#fee2e2' : '#dcfce7', isBad ? '#991b1b' : '#166534')}>
            CBR retenu = {cbr_retenu} %
          </span>
        )}
      </div>
    </div>
  )
}

function badge(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700 }
}
