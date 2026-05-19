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

type PresPoint = { p_kpa: number; volume_cm3: number }

export default function PressiometreSection({ data }: Props) {
  const points = (Array.isArray(data.points) ? data.points : []) as PresPoint[]
  const pl_kpa = data.pl_kpa as number | undefined
  const em_mpa = data.em_mpa as number | undefined
  const profondeur_m = data.profondeur_m as number | undefined

  return (
    <div>
      {profondeur_m != null && (
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          Profondeur : {profondeur_m} m
        </p>
      )}

      <table className="rpt-table">
        <thead>
          <tr>
            <th>P (kPa)</th>
            <th>Volume (cm³)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.p_kpa}</td>
              <td>{p.volume_cm3}</td>
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
                dataKey="p_kpa"
                label={{ value: 'P (kPa)', position: 'insideBottom', offset: -4 }}
              />
              <YAxis
                label={{ value: 'Volume (cm³)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="volume_cm3"
                name="Volume (cm³)"
                stroke="#1e40af"
                dot={{ r: 3 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(pl_kpa != null || em_mpa != null) && (
        <div
          style={{
            display: 'inline-flex',
            gap: '1.5rem',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '0.6rem 1.2rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: '#1e40af',
          }}
        >
          {pl_kpa != null && <span>Pl = {pl_kpa} kPa</span>}
          {em_mpa != null && <span>Em = {em_mpa} MPa</span>}
        </div>
      )}
    </div>
  )
}
