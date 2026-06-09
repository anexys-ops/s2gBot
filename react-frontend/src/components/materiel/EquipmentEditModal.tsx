import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi, type EquipmentRow } from '../../api/client'
import Modal from '../Modal'
import EquipmentFormFields from './EquipmentFormFields'
import { equipmentFormFromRow, equipmentFormToPayload } from './equipmentFormUtils'

type Props = {
  equipment: EquipmentRow
  onClose: () => void
  onUpdated?: () => void
}

export default function EquipmentEditModal({ equipment, onClose, onUpdated }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => equipmentFormFromRow(equipment))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm(equipmentFormFromRow(equipment))
  }, [equipment])

  const updateMutation = useMutation({
    mutationFn: () => equipmentsApi.update(equipment.id, equipmentFormToPayload(form)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipments'] })
      void queryClient.invalidateQueries({ queryKey: ['equipment', equipment.id] })
      setSaved(true)
      onUpdated?.()
      window.setTimeout(() => {
        setSaved(false)
        onClose()
      }, 600)
    },
  })

  const canSubmit = form.name.trim() !== '' && form.code.trim() !== '' && !updateMutation.isPending

  return (
    <Modal title={`Modifier — ${equipment.code}`} onClose={updateMutation.isPending ? () => {} : onClose}>
      <form
        className="catalogue-article-new-form equipment-create-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          updateMutation.mutate()
        }}
      >
        <p className="equipment-create-form__intro text-muted">
          Mettez à jour les informations du parc matériel. Le code reste modifiable tant qu&apos;il reste unique.
        </p>

        <EquipmentFormFields form={form} onChange={setForm} autoFocusCode />

        {updateMutation.isError ? <p className="error">{(updateMutation.error as Error).message}</p> : null}
        {saved ? <p className="text-muted equipment-edit-form__saved">Modifications enregistrées.</p> : null}

        <div className="crud-actions catalogue-article-new-form__actions">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={updateMutation.isPending}
            onClick={() => setForm(equipmentFormFromRow(equipment))}
          >
            Annuler les modifications
          </button>
        </div>
      </form>
    </Modal>
  )
}
