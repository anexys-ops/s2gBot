import { QUOTE_UNITES, quoteUniteLabel } from '../../lib/quoteUnites'

type Props = {
  value: string | null | undefined
  onChange: (code: string) => void
  disabled?: boolean
  title?: string
  className?: string
  allowEmpty?: boolean
}

export default function UniteSelect({
  value,
  onChange,
  disabled = false,
  title,
  className = 'quote-lines-table__unite',
  allowEmpty = false,
}: Props) {
  const current = (value ?? '').trim()
  const known = QUOTE_UNITES.some((u) => u.code === current)

  return (
    <select
      className={className}
      value={current}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty ? <option value="">—</option> : null}
      {!known && current ? <option value={current}>{quoteUniteLabel(current)}</option> : null}
      {QUOTE_UNITES.map((u) => (
        <option key={u.code} value={u.code}>
          {u.libelle === u.code ? u.code : `${u.code} — ${u.libelle}`}
        </option>
      ))}
    </select>
  )
}
