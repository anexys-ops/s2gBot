import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi, type EquipmentRow } from '../../api/client'
import EquipmentFormFields from './EquipmentFormFields'
import { equipmentFormFromRow, equipmentFormToPayload } from './equipmentFormUtils'

type Props = {
  equipment: EquipmentRow
  onUpdated: () => void
}

export default function EquipmentEditorPanel({ equipment, onUpdated }: Props) {
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
      onUpdated()
      window.setTimeout(() => setSaved(false), 4000)
    },
  })

  const canSubmit = form.name.trim() !== '' && form.code.trim() !== '' && !updateMutation.isPending

  return (
    <section className="card equipment-edit-panel">
      <h2 className="equipment-fiche__section-title">Modifier l&apos;équipement</h2>
      <p className="equipment-edit-panel__intro text-muted">
        Mise à jour de la fiche matériel en base (identité, localisation, statut, types d&apos;essai).
      </p>
      <form
        className="catalogue-article-new-form equipment-create-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          updateMutation.mutate()
        }}
      >
        <EquipmentFormFields form={form} onChange={setForm} />

        {updateMutation.isError ? <p className="error">{(updateMutation.error as Error).message}</p> : null}
        {saved ? <p className="text-muted equipment-edit-form__saved">Modifications enregistrées.</p> : null}

        <div className="crud-actions catalogue-article-new-form__actions article-edit__actions">
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
    </section>
  )
}
