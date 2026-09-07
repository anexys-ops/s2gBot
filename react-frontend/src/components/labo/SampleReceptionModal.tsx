import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import {
  adminUsersApi,
  samplesReceptionApi,
  type LabReceptionAttendu,
  type ReceiveFromLineBody,
  type ReceiveSampleBody,
  type ReceptionSample,
} from '../../api/client'

const SAMPLE_TYPES = ['sol', 'eau', 'beton', 'granulat', 'roche', 'enrobe', 'autre'] as const

export type ReceptionMode =
  | { kind: 'from_line'; line: LabReceptionAttendu }
  | { kind: 'transit'; sample: ReceptionSample }

type Props = {
  mode: ReceptionMode
  onClose: () => void
  onSuccess: (sample: ReceptionSample) => void
}

export default function SampleReceptionModal({ mode, onClose, onSuccess }: Props) {
  const isFromLine = mode.kind === 'from_line'
  const line = isFromLine ? mode.line : null
  const transitSample = !isFromLine ? mode.sample : null

  const defaultTechnicienId = line?.technicien?.id ?? transitSample?.collected_by?.id

  const [conditionState, setConditionState] = useState<'bon' | 'endommage' | 'insuffisant'>('bon')
  const [storageLocation, setStorageLocation] = useState('')
  const [collectedBy, setCollectedBy] = useState<number | ''>(defaultTechnicienId ?? '')
  const [sampleType, setSampleType] = useState<string>(transitSample?.sample_type ?? 'sol')
  const [weightG, setWeightG] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: usersRes } = useQuery({
    queryKey: ['admin-users', 'reception'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    staleTime: 120_000,
  })
  const users = usersRes?.data ?? []

  const title = isFromLine
    ? `Réception — ${line?.libelle ?? 'Produit attendu'}`
    : `Réceptionner ${transitSample?.fold_number ?? 'FOLD'}`

  const handlePhotoChange = (file: File | undefined) => {
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    setError(null)
    setBusy(true)
    try {
      let sample: ReceptionSample

      if (isFromLine && line) {
        const body: ReceiveFromLineBody = {
          bon_commande_ligne_id: line.id,
          condition_state: conditionState,
          storage_location: storageLocation || undefined,
          collected_by: collectedBy ? Number(collectedBy) : undefined,
          sample_type: sampleType,
          weight_g: weightG ? Number(weightG) : undefined,
          quantity: quantity ? Number(quantity) : undefined,
          notes: notes || undefined,
        }
        sample = await samplesReceptionApi.receiveFromLine(body)
      } else if (transitSample) {
        const body: ReceiveSampleBody = {
          condition_state: conditionState,
          storage_location: storageLocation || undefined,
          collected_by: collectedBy ? Number(collectedBy) : undefined,
          weight_g: weightG ? Number(weightG) : undefined,
          quantity: quantity ? Number(quantity) : undefined,
          notes: notes || undefined,
        }
        sample = await samplesReceptionApi.receive(transitSample.id, body)
      } else {
        throw new Error('Contexte réception invalide.')
      }

      if (photoFile) {
        sample = { ...sample, ...(await samplesReceptionApi.uploadPhoto(sample.id, photoFile)) }
      }

      onSuccess(sample)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réception')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      {isFromLine && line && (
        <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
          BC {line.bon_commande?.numero ?? '—'} · {line.chantier?.name ?? '—'} · {line.dossier?.reference ?? '—'}
          <br />
          Reste à recevoir : <strong>{line.quantite_manquante}</strong> / {line.quantite_attendue}
        </p>
      )}

      {!isFromLine && transitSample && (
        <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
          {transitSample.product?.libelle ?? transitSample.bon_commande_ligne?.libelle ?? '—'}
        </p>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {isFromLine && (
          <label>
            <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Type échantillon</span>
            <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} style={{ width: '100%' }}>
              {SAMPLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}

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
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Remis par (prélèvement terrain)</span>
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
            placeholder="Ex. Salle B / Étagère 3"
            style={{ width: '100%' }}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
            <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Quantité</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        </div>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Photo échantillon</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoChange(e.target.files?.[0])}
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Aperçu échantillon"
              style={{ marginTop: 8, maxWidth: '100%', maxHeight: 160, borderRadius: 6 }}
            />
          )}
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ width: '100%' }}
          />
        </label>
      </div>

      {error && <p className="error" style={{ marginTop: '0.75rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? '…' : 'Confirmer la réception'}
        </button>
      </div>
    </Modal>
  )
}
