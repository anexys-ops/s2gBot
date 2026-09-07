import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import {
  adminUsersApi,
  samplesReceptionApi,
  type LabReceptionAttendu,
  type ReceiveSampleBody,
  type ReceptionSample,
} from '../../api/client'
import {
  SAMPLE_TYPES,
  createEmptyDraft,
  draftToReceiveBody,
  type SampleFormDraft,
} from '../../lib/sampleReceptionForm'

export type ReceptionMode =
  | { kind: 'from_line'; line: LabReceptionAttendu }
  | { kind: 'transit'; sample: ReceptionSample }

type Props = {
  mode: ReceptionMode
  onClose: () => void
  onSuccess: (samples: ReceptionSample[]) => void
}

type Step = 'count' | 'forms' | 'done'

function SampleFormCard({
  index,
  draft,
  users,
  onChange,
  onRemove,
  canRemove,
  showType,
}: {
  index: number
  draft: SampleFormDraft
  users: { id: number; name: string }[]
  onChange: (patch: Partial<SampleFormDraft>) => void
  onRemove: () => void
  canRemove: boolean
  showType: boolean
}) {
  const handlePhoto = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () =>
      onChange({
        photoFile: file,
        photoPreview: typeof reader.result === 'string' ? reader.result : null,
      })
    reader.readAsDataURL(file)
  }

  return (
    <article className="sample-reception-card">
      <header className="sample-reception-card__head">
        <h3 className="sample-reception-card__title">Échantillon {index + 1}</h3>
        {canRemove && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRemove}>
            Retirer
          </button>
        )}
      </header>

      <div className="sample-reception-card__grid">
        {showType && (
          <label>
            <span>Type</span>
            <select
              value={draft.sample_type}
              onChange={(e) => onChange({ sample_type: e.target.value })}
            >
              {SAMPLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span>État</span>
          <select
            value={draft.condition_state}
            onChange={(e) => onChange({ condition_state: e.target.value as SampleFormDraft['condition_state'] })}
          >
            <option value="bon">Bon état</option>
            <option value="endommage">Endommagé</option>
            <option value="insuffisant">Quantité insuffisante</option>
          </select>
        </label>

        <label>
          <span>Remis par</span>
          <select
            value={draft.collected_by}
            onChange={(e) => onChange({ collected_by: e.target.value ? Number(e.target.value) : '' })}
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Stockage</span>
          <input
            type="text"
            value={draft.storage_location}
            onChange={(e) => onChange({ storage_location: e.target.value })}
            placeholder="Salle B / Étagère 3"
          />
        </label>

        <label>
          <span>Poids (g)</span>
          <input
            type="number"
            min={0}
            value={draft.weight_g}
            onChange={(e) => onChange({ weight_g: e.target.value })}
          />
        </label>

        <label className="sample-reception-card__full">
          <span>Notes</span>
          <textarea
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={2}
          />
        </label>

        <label className="sample-reception-card__full">
          <span>Photo</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhoto(e.target.files?.[0])} />
          {draft.photoPreview && (
            <img src={draft.photoPreview} alt="" className="sample-reception-card__photo" />
          )}
        </label>
      </div>
    </article>
  )
}

export default function SampleReceptionModal({ mode, onClose, onSuccess }: Props) {
  const isFromLine = mode.kind === 'from_line'
  const line = isFromLine ? mode.line : null
  const transitSample = !isFromLine ? mode.sample : null

  const maxCount = isFromLine ? Math.max(1, line?.quantite_manquante ?? 1) : 1
  const defaultTechnicienId = line?.technicien?.id ?? transitSample?.collected_by?.id

  const [step, setStep] = useState<Step>(isFromLine ? 'count' : 'forms')
  const [labelCount, setLabelCount] = useState(1)
  const [drafts, setDrafts] = useState<SampleFormDraft[]>(() => [
    createEmptyDraft(0, { collected_by: defaultTechnicienId ?? '' }),
  ])
  const [createdSamples, setCreatedSamples] = useState<ReceptionSample[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: usersRes } = useQuery({
    queryKey: ['admin-users', 'reception'],
    queryFn: () => adminUsersApi.list({ page: 1 }),
    staleTime: 120_000,
  })
  const users = usersRes?.data ?? []

  const commonDefaults = useMemo(
    () => ({
      condition_state: (drafts[0]?.condition_state ?? 'bon') as SampleFormDraft['condition_state'],
      storage_location: drafts[0]?.storage_location ?? '',
      collected_by: drafts[0]?.collected_by ?? '',
      sample_type: drafts[0]?.sample_type ?? 'sol',
    }),
    [drafts],
  )

  const updateDraft = (index: number, patch: Partial<SampleFormDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const applyCommonToAll = () => {
    setDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        condition_state: commonDefaults.condition_state as SampleFormDraft['condition_state'],
        storage_location: commonDefaults.storage_location,
        collected_by: commonDefaults.collected_by,
        sample_type: commonDefaults.sample_type,
      })),
    )
  }

  const handlePrepareForms = () => {
    const count = Math.min(Math.max(1, labelCount), maxCount)
    setLabelCount(count)
    setDrafts(
      Array.from({ length: count }, (_, i) =>
        createEmptyDraft(i, { collected_by: defaultTechnicienId ?? '' }),
      ),
    )
    setStep('forms')
  }

  const uploadPhotos = async (samples: ReceptionSample[]) => {
    const out: ReceptionSample[] = []
    for (let i = 0; i < samples.length; i++) {
      const draft = drafts[i]
      let sample = samples[i]
      if (draft?.photoFile) {
        await samplesReceptionApi.uploadPhoto(sample.id, draft.photoFile)
        sample = await samplesReceptionApi.get(sample.id)
      }
      out.push(sample)
    }
    return out
  }

  const handleSubmit = async () => {
    setError(null)
    setBusy(true)
    try {
      let samples: ReceptionSample[] = []

      if (isFromLine && line) {
        if (drafts.length === 1) {
          const one = await samplesReceptionApi.receiveFromLine({
            bon_commande_ligne_id: line.id,
            ...draftToReceiveBody(drafts[0]),
          })
          samples = [one]
        } else {
          const res = await samplesReceptionApi.receiveBatchFromLine({
            bon_commande_ligne_id: line.id,
            samples: drafts.map((d) => draftToReceiveBody(d)),
          })
          samples = res.data
        }
      } else if (transitSample) {
        const body: ReceiveSampleBody = {
          ...draftToReceiveBody(drafts[0]),
        }
        samples = [await samplesReceptionApi.receive(transitSample.id, body)]
      } else {
        throw new Error('Contexte réception invalide.')
      }

      samples = await uploadPhotos(samples)
      setCreatedSamples(samples)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réception')
    } finally {
      setBusy(false)
    }
  }

  const title = isFromLine
    ? `Réception — ${line?.libelle ?? 'Produit attendu'}`
    : `Réceptionner ${transitSample?.fold_number ?? 'FOLD'}`

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      {isFromLine && line && step !== 'done' && (
        <p className="text-muted sample-reception-intro">
          BC {line.bon_commande?.numero ?? '—'} · {line.chantier?.name ?? '—'} · {line.dossier?.reference ?? '—'}
          <br />
          Reste à recevoir : <strong>{line.quantite_manquante}</strong> / {line.quantite_attendue}
        </p>
      )}

      {step === 'count' && isFromLine && (
        <div className="sample-reception-count">
          <label>
            <span className="sample-reception-count__label">Nombre d&apos;échantillons / étiquettes</span>
            <input
              type="number"
              min={1}
              max={maxCount}
              value={labelCount}
              onChange={(e) => setLabelCount(Number(e.target.value))}
            />
          </label>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Un formulaire et une étiquette FOLD seront générés pour chaque échantillon (max. {maxCount}).
          </p>
          <div className="sample-reception-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="button" className="btn btn-primary" onClick={handlePrepareForms}>
              Préparer les formulaires
            </button>
          </div>
        </div>
      )}

      {step === 'forms' && (
        <>
          {isFromLine && drafts.length > 1 && (
            <div className="sample-reception-toolbar">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep('count')}>
                ← Changer le nombre
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={applyCommonToAll}>
                Appliquer échantillon 1 à tous
              </button>
            </div>
          )}

          <div className="sample-reception-forms">
            {drafts.map((draft, index) => (
              <SampleFormCard
                key={draft.key}
                index={index}
                draft={draft}
                users={users}
                showType={isFromLine}
                canRemove={isFromLine && drafts.length > 1}
                onChange={(patch) => updateDraft(index, patch)}
                onRemove={() => {
                  setDrafts((prev) => prev.filter((_, i) => i !== index))
                  setLabelCount((c) => Math.max(1, c - 1))
                }}
              />
            ))}
          </div>

          {error && <p className="error">{error}</p>}

          <div className="sample-reception-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? '…' : `Réceptionner ${drafts.length} échantillon${drafts.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {step === 'done' && (
        <div className="sample-reception-done">
          <p className="sample-reception-done__msg">
            {createdSamples.length} échantillon{createdSamples.length > 1 ? 's' : ''} réceptionné{createdSamples.length > 1 ? 's' : ''}.
          </p>
          <ul className="sample-reception-done__list">
            {createdSamples.map((s) => (
              <li key={s.id}>
                <strong>{s.fold_number}</strong>
                <span className="text-muted"> · Transco {s.transco_number ?? '—'}</span>
              </li>
            ))}
          </ul>
          <div className="sample-reception-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Fermer</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onSuccess(createdSamples)}
            >
              Voir les étiquettes
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
