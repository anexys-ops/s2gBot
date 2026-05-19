type Props = { data: Record<string, unknown> }

type Mesure = {
  label?: string
  masse_humide_g?: number
  masse_seche_g?: number
  teneur_pct?: number
}

export default function TeneurEauSection({ data }: Props) {
  const mesures = (Array.isArray(data.mesures) ? data.mesures : []) as Mesure[]

  const teneurs = mesures
    .map((m) => m.teneur_pct)
    .filter((v): v is number => v != null)
  const moyenne =
    teneurs.length > 0 ? +(teneurs.reduce((a, b) => a + b, 0) / teneurs.length).toFixed(1) : null

  return (
    <div>
      <table className="rpt-table">
        <thead>
          <tr>
            <th>Mesure</th>
            <th>Masse humide (g)</th>
            <th>Masse sèche (g)</th>
            <th>Teneur en eau (%)</th>
          </tr>
        </thead>
        <tbody>
          {mesures.map((m, i) => (
            <tr key={i}>
              <td>{m.label ?? `Mesure ${i + 1}`}</td>
              <td>{m.masse_humide_g ?? '—'}</td>
              <td>{m.masse_seche_g ?? '—'}</td>
              <td>{m.teneur_pct ?? '—'}</td>
            </tr>
          ))}
          {moyenne != null && (
            <tr>
              <td colSpan={3} style={{ fontWeight: 700 }}>Moyenne</td>
              <td style={{ fontWeight: 700 }}>{moyenne} %</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
