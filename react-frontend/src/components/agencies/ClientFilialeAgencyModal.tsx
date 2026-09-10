import { useEffect, useState } from 'react'
import type { AgencyRow } from '../../api/client'
import Modal from '../Modal'
import { filialeAgencyLabel } from '../../lib/clientFilialeAgency'

type Props = {
  open: boolean
  title?: string
  agencies: AgencyRow[]
  initialAgencyId?: number | null
  onConfirm: (agencyId: number) => void
  onClose: () => void
}

export default function ClientFilialeAgencyModal({
  open,
  title = 'Choisir l’agence filiale',
  agencies,
  initialAgencyId,
  onConfirm,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | ''>(initialAgencyId ?? '')

  useEffect(() => {
    if (!open) return
    setSelectedId(initialAgencyId ?? agencies[0]?.id ?? '')
  }, [open, initialAgencyId, agencies])

  if (!open) return null

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-muted" style={{ fontSize: '0.92rem' }}>
        Ce choix sera utilisé par défaut pour les numéros de documents (ex. DEV-2026-0001/PAR).
      </p>
      <div className="form-group">
        <label htmlFor="filiale-agency-modal">Agence filiale *</label>
        <select
          id="filiale-agency-modal"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value === '' ? '' : Number(e.target.value))}
          required
        >
          <option value="">— Choisir —</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {filialeAgencyLabel(a)}
            </option>
          ))}
        </select>
      </div>
      <div className="crud-actions" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={selectedId === ''}
          onClick={() => {
            if (selectedId === '') return
            onConfirm(Number(selectedId))
          }}
        >
          Valider
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Modal>
  )
}
