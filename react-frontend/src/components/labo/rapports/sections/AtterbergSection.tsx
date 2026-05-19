type Props = { data: Record<string, unknown> }

export default function AtterbergSection({ data }: Props) {
  const wl = data.wl as number | undefined
  const wp = data.wp as number | undefined
  const ip = wl != null && wp != null ? +(wl - wp).toFixed(1) : (data.ip as number | undefined)
  const ic = data.ic as number | undefined
  const classification = data.classification as string | undefined

  const classifyPlasticity = (ipVal?: number): string => {
    if (ipVal == null) return ''
    if (ipVal < 7) return 'Peu plastique'
    if (ipVal < 17) return 'Plastique'
    if (ipVal < 35) return 'Très plastique'
    return 'Extrêmement plastique'
  }

  return (
    <div>
      <table className="rpt-table">
        <thead>
          <tr>
            <th>Wl (%)</th>
            <th>Wp (%)</th>
            <th>Ip (%)</th>
            <th>Ic</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{wl ?? '—'}</td>
            <td>{wp ?? '—'}</td>
            <td>{ip ?? '—'}</td>
            <td>{ic ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
        {ip != null && (
          <span style={badgeStyle('#eff6ff', '#1e40af')}>{classifyPlasticity(ip)}</span>
        )}
        {classification && (
          <span style={badgeStyle('#dcfce7', '#166534')}>{classification}</span>
        )}
        {ic != null && (
          <span style={badgeStyle('#fef9c3', '#854d0e')}>
            Ic = {ic} {ic >= 1 ? '— Sol rigide' : ic >= 0.5 ? '— Sol ferme' : '— Sol mou'}
          </span>
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
