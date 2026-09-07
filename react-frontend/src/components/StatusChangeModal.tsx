import { useState } from 'react'
import Modal from './Modal'

export type StatusOption = { value: string; label: string }

type Props = {
  title?: string
  initialValue: string
  options: StatusOption[]
  onClose: () => void
  onSave: (value: string) => void
  isPending?: boolean
  error?: string | null
}

export default function StatusChangeModal({
  title = 'Changer le statut',
  initialValue,
  options,
  onClose,
  onSave,
  isPending = false,
  error = null,
}: Props) {
  const [value, setValue] = useState(initialValue)

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="status-change-select">Statut</label>
        <select
          id="status-change-select"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="crud-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={isPending}
          onClick={() => onSave(value)}
        >
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isPending}>
          Annuler
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </Modal>
  )
}
