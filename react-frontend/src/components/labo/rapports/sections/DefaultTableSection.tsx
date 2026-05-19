type Props = { data: Record<string, unknown> }

export default function DefaultTableSection({ data }: Props) {
  const entries = Object.entries(data)

  if (entries.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Aucune donnée disponible.</p>
  }

  return (
    <table className="rpt-table">
      <thead>
        <tr>
          <th>Paramètre</th>
          <th>Valeur</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <td style={{ fontWeight: 600 }}>{key}</td>
            <td>
              {value === null || value === undefined
                ? '—'
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
