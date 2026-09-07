import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import {
  adminUsersApi,
  samplesReceptionApi,
  type ReceptionSample,
} from '../../api/client'
import { SAMPLE_TYPES, type SampleFormDraft } from '../../lib/sampleReceptionForm'

type Props = {
  sample: ReceptionSample
  onClose: () => void
  onSaved: (sample: ReceptionSample) => void
  onDeleted?: () => void
  onPrintLabel?: (sampleId: number) => void
}

export default function SampleEditModal({ sample, onClose, onSaved, onDeleted, onPrintLabel }: Props) {
  const [conditionState, setConditionState] = useState<SampleFormDraft['condition_state']>(
    (sample.condition_state as SampleFormDraft['condition_state']) ?? 'bon',
  )
  const [storageLocation, setStorageLocation] = useState(sample.storage_location ?? '')
  const [collectedBy, setCollectedBy] = useState<number | ''>(sample.collected_by?.id ?? '')
  const [sampleType, setSampleType] = useState(sample.sample_type ?? 'sol')
  const [weightG, setWeightG] = useState(sample.weight_g != null ? String(sample.weight_g) : '')
  const [notes, setNotes] = useState(sample.notes ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    sample.photo_path ? samplesReceptionApi.photoUrl(sample.id) : null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: usersRes } = useQuery({
    queryKey: ['admin-users', 'reception'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    staleTime: 120_000,
  })
  const users = usersRes?.data ?? []

  const handlePhotoChange = (file: File | undefined) => {
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setError(null)
    setBusy(true)
    try {
      let updated = await samplesReceptionApi.update(sample.id, {
        condition_state: conditionState,
        storage_location: storageLocation || undefined,
        collected_by: collectedBy ? Number(collectedBy) : undefined,
        sample_type: sampleType,
        weight_g: weightG ? Number(weightG) : undefined,
        notes: notes || undefined,
      })
      if (photoFile) {
        await samplesReceptionApi.uploadPhoto(sample.id, photoFile)
        updated = await samplesReceptionApi.get(sample.id)
      }
      onSaved(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer l'échantillon ${sample.fold_number} ?`)) return
    setBusy(true)
    try {
      await samplesReceptionApi.delete(sample.id)
      onDeleted?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Modifier ${sample.fold_number ?? 'échantillon'}`} onClose={busy ? () => {} : onClose}>
      <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
        Transco {sample.transco_number ?? '—'} · {sample.product?.libelle ?? sample.bon_commande_ligne?.libelle ?? '—'}
      </p>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Type échantillon</span>
          <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} style={{ width: '100%' }}>
            {SAMPLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>État à réception</span>
          <select
            value={conditionState}
            onChange={(e) => setConditionState(e.target.value as typeof conditionState)}
            style={{ width: '100%' }}
          >
            <option value="bon">Bon état</option>
            <option value="endommage">Endommagé</option>
            <option value="insuffisant">Quantité insuffisante</option>
          </select>
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Remis par</span>
          <select
            value={collectedBy}
            onChange={(e) => setCollectedBy(e.target.value ? Number(e.target.value) : '')}
            style={{ width: '100%' }}
          >
            <option value="">— Non renseigné —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Emplacement stockage</span>
          <input
            type="text"
            value={storageLocation}
            onChange={(e) => setStorageLocation(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Poids (g)</span>
          <input
            type="number"
            min={0}
            value={weightG}
            onChange={(e) => setWeightG(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Photo</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
          {photoPreview && (
            <img src={photoPreview} alt="Aperçu" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 140, borderRadius: 6 }} />
          )}
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: '100%' }} />
        </label>
      </div>

      {error && <p className="error" style={{ marginTop: '0.75rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handleDelete()}>
          Supprimer
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onPrintLabel && sample.transco_number && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onPrintLabel(sample.id)}>
              Étiquette
            </button>
          )}
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleSave()}>
            {busy ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
