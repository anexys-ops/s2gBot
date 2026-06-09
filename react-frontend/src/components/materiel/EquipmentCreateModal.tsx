import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi } from '../../api/client'
import Modal from '../Modal'
import EquipmentFormFields from './EquipmentFormFields'
import { emptyEquipmentForm, equipmentFormToPayload } from './equipmentFormUtils'

type Props = {
  onClose: () => void
  onCreated?: () => void
}

export default function EquipmentCreateModal({ onClose, onCreated }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyEquipmentForm)

  const createMutation = useMutation({
    mutationFn: () => equipmentsApi.create(equipmentFormToPayload(form)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipments'] })
      onCreated?.()
      onClose()
    },
  })

  const canSubmit = form.name.trim() !== '' && form.code.trim() !== '' && !createMutation.isPending

  return (
    <Modal title="Nouvel équipement" onClose={createMutation.isPending ? () => {} : onClose}>
      <form
        className="catalogue-article-new-form equipment-create-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          createMutation.mutate()
        }}
      >
        <p className="equipment-create-form__intro text-muted">
          Créez une fiche matériel complète : identité, localisation, statut et types d&apos;essai associés.
        </p>

        <EquipmentFormFields form={form} onChange={setForm} autoFocusCode />

        {createMutation.isError ? <p className="error">{(createMutation.error as Error).message}</p> : null}

        <div className="crud-actions catalogue-article-new-form__actions">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {createMutation.isPending ? 'Création…' : 'Créer l’équipement'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={createMutation.isPending} onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  )
}
