import { isAppError } from '../../lib/errors'

type Props = {
  error: unknown
  field: string
  className?: string
}

export default function FieldError({ error, field, className = 'field-error' }: Props) {
  if (!isAppError(error)) return null
  const messages = error.fieldErrors[field]
  if (!messages?.length) return null
  return <p className={className}>{messages.join(' ')}</p>
}

type ListProps = {
  error: unknown
  className?: string
}

export function FieldErrorList({ error, className = 'field-error-list' }: ListProps) {
  if (!isAppError(error)) return null
  const entries = Object.entries(error.fieldErrors).filter(([, msgs]) => msgs.length > 0)
  if (entries.length === 0) return null
  return (
    <ul className={className}>
      {entries.flatMap(([field, msgs]) =>
        msgs.map((msg) => (
          <li key={`${field}-${msg}`}>
            <strong>{field}</strong> — {msg}
          </li>
        )),
      )}
    </ul>
  )
}
