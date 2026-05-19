import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

type Props = { data: Record<string, unknown> }

type Eprouvette = { label?: string; rc_mpa: number; age_j?: number }

export default function BetonCompressionSection({ data }: Props) {
  const eprouvettes = (Array.isArray(data.eprouvettes) ? data.eprouvettes : []) as Eprouvette[]
  const fc28_specifie = data.fc28_specifie as number | undefined
  const rc_moyen =
    eprouvettes.length > 0
      ? +(eprouvettes.reduce((s, e) => s + e.rc_mpa, 0) / eprouvettes.length).toFixed(2)
      : (data.rc_moyen as number | undefined)

  const chartData = eprouvettes.map((e, i) => ({
    name: e.label ?? `E${i + 1}`,
    rc_mpa: e.rc_mpa,
    age_j: e.age_j,
  }))

  const isNonConforme = fc28_specifie != null && rc_moyen != null && rc_moyen < fc28_specifie

  return (
    <div>
      <table className="rpt-table">
        <thead>
          <tr>
            <th>Éprouvette</th>
            {eprouvettes.some((e) => e.age_j != null) && <th>Âge (j)</th>}
            <th>Rc (MPa)</th>
          </tr>
        </thead>
        <tbody>
          {eprouvettes.map((e, i) => (
            <tr key={i}>
              <td>{e.label ?? `E${i + 1}`}</td>
              {eprouvettes.some((ev) => ev.age_j != null) && <td>{e.age_j ?? '—'}</td>}
              <td>{e.rc_mpa}</td>
            </tr>
          ))}
          {rc_moyen != null && (
            <tr>
              <td colSpan={eprouvettes.some((e) => e.age_j != null) ? 2 : 1} style={{ fontWeight: 700 }}>
                Moyenne
              </td>
              <td style={{ fontWeight: 700 }}>{rc_moyen}</td>
            </tr>
          )}
        </tbody>
      </table>

      {chartData.length > 0 && (
        <div className="rpt-chart" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Rc (MPa)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="rc_mpa" name="Rc (MPa)" fill="#1e40af" />
              {rc_moyen != null && (
                <ReferenceLine
                  y={rc_moyen}
                  stroke="#6b7280"
                  strokeDasharray="4 2"
                  label={{ value: `Moy. ${rc_moyen}`, position: 'right', fontSize: 11 }}
                />
              )}
              {fc28_specifie != null && (
                <ReferenceLine
                  y={fc28_specifie}
                  stroke={isNonConforme ? '#ef4444' : '#10b981'}
                  strokeDasharray="4 2"
                  label={{
                    value: `fc28 = ${fc28_specifie}`,
                    position: 'insideTopRight',
                    fill: isNonConforme ? '#ef4444' : '#10b981',
                    fontSize: 11,
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {rc_moyen != null && (
          <span style={badge('#eff6ff', '#1e40af')}>Rc moyen = {rc_moyen} MPa</span>
        )}
        {fc28_specifie != null && (
          <span style={badge('#f1f5f9', '#374151')}>fc28 spécifié = {fc28_specifie} MPa</span>
        )}
        {isNonConforme && (
          <span style={badge('#fee2e2', '#991b1b')}>Non conforme</span>
        )}
        {!isNonConforme && rc_moyen != null && fc28_specifie != null && (
          <span style={badge('#dcfce7', '#166534')}>Conforme</span>
        )}
      </div>
    </div>
  )
}

function badge(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700 }
}
