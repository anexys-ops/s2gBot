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

type PandaPoint = { profondeur_m: number; qd_mpa: number }

export default function PandaSection({ data }: Props) {
  const points = (Array.isArray(data.points) ? data.points : []) as PandaPoint[]
  const seuil_portance_mpa = data.seuil_portance_mpa as number | undefined

  // Pour le chart PANDA : axe X = qd_mpa, axe Y = profondeur (inversé)
  const chartData = [...points].sort((a, b) => a.profondeur_m - b.profondeur_m)

  return (
    <div>
      <table className="rpt-table">
        <thead>
          <tr>
            <th>Profondeur (m)</th>
            <th>qd (MPa)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.profondeur_m}</td>
              <td>{p.qd_mpa}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {chartData.length > 1 && (
        <div className="rpt-chart" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 40, left: 16, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="qd_mpa"
                label={{ value: 'qd (MPa)', position: 'insideBottom', offset: -4 }}
              />
              <YAxis
                type="number"
                dataKey="profondeur_m"
                reversed
                label={{ value: 'Profondeur (m)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="qd_mpa"
                name="qd (MPa)"
                stroke="#1e40af"
                dot={{ r: 3 }}
                strokeWidth={2}
              />
              {seuil_portance_mpa != null && (
                <ReferenceLine
                  x={seuil_portance_mpa}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  label={{
                    value: `Seuil ${seuil_portance_mpa} MPa`,
                    position: 'top',
                    fill: '#ef4444',
                    fontSize: 11,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
