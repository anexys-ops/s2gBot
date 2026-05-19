type Props = { data: Record<string, unknown> }

export default function SlumpSection({ data }: Props) {
  const slump_cm = data.slump_cm as number | undefined
  const classe = data.classe as string | undefined
  const conforme = data.conforme as boolean | undefined
  const specificite = data.specificite as string | undefined

  const isOk = conforme !== false

  return (
    <div>
      <table className="rpt-table" style={{ marginBottom: '1rem' }}>
        <thead>
          <tr>
            <th>Affaissement (cm)</th>
            <th>Classe</th>
            {specificite != null && <th>Spécification</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{slump_cm ?? '—'} cm</td>
            <td>{classe ?? '—'}</td>
            {specificite != null && <td>{specificite}</td>}
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
        <span
          style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            padding: '0.6rem 1.8rem',
            borderRadius: 16,
            background: isOk ? '#dcfce7' : '#fee2e2',
            color: isOk ? '#166534' : '#991b1b',
            border: `2px solid ${isOk ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {classe ? `${classe} — ` : ''}
          {isOk ? 'Conforme' : 'Non conforme'}
        </span>
      </div>
    </div>
  )
}
