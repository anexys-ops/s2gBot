import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
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
  type CancelledSlot,
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

/** Plusieurs échantillons physiques (étiquettes FOLD) par ligne BC, indépendamment de la quantité d'essais commandés. */
const MAX_ECHANTILLONS_PAR_LOT = 50

type Step = 'forms' | 'done'

function parseCount(raw: string, max: number): number {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1) return 1
  return Math.min(n, max)
}

function buildDraftsForBatch(
  batchTotal: number,
  cancelled: CancelledSlot[],
  previous: SampleFormDraft[],
  defaultTechnicienId?: number,
): SampleFormDraft[] {
  const cancelledIndices = new Set(cancelled.map((c) => c.reception_index))
  const byIndex = new Map(previous.map((d) => [d.reception_index, d]))
  const out: SampleFormDraft[] = []

  for (let i = 1; i <= batchTotal; i++) {
    if (cancelledIndices.has(i)) continue
    out.push(
      byIndex.get(i) ??
        createEmptyDraft(i, { collected_by: defaultTechnicienId ?? '' }),
    )
  }

  return out
}

function computeBatchState(
  raw: string,
  max: number,
  prevCancelled: CancelledSlot[],
  prevDrafts: SampleFormDraft[],
  prevBatchTotal: number,
  defaultTechnicienId?: number,
): { parsed: number; cancelled: CancelledSlot[]; drafts: SampleFormDraft[] } {
  const parsed = parseCount(raw, max)
  let cancelled = [...prevCancelled]
  if (parsed < prevBatchTotal) {
    for (let i = parsed + 1; i <= prevBatchTotal; i++) {
      if (!cancelled.some((c) => c.reception_index === i)) {
        cancelled = [
          ...cancelled,
          { reception_index: i, reason: 'Réduction du nombre d\'échantillons' },
        ]
      }
    }
  } else {
    cancelled = cancelled.filter((c) => c.reception_index <= parsed)
  }

  return {
    parsed,
    cancelled,
    drafts: buildDraftsForBatch(parsed, cancelled, prevDrafts, defaultTechnicienId),
  }
}

function SampleFormCard({
  draft,
  batchTotal,
  users,
  onChange,
  onRemove,
  canRemove,
  showType,
}: {
  draft: SampleFormDraft
  batchTotal: number
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
        <h3 className="sample-reception-card__title">
          Échantillon {draft.reception_index}/{batchTotal}
        </h3>
        {canRemove && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRemove}>
            Annuler cette étiquette
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

  const maxCount = MAX_ECHANTILLONS_PAR_LOT
  const defaultTechnicienId = line?.technicien?.id ?? transitSample?.collected_by?.id

  const [step, setStep] = useState<Step>('forms')
  const [countInput, setCountInput] = useState('1')
  const [batchTotal, setBatchTotal] = useState(1)
  const [cancelledSlots, setCancelledSlots] = useState<CancelledSlot[]>([])
  const [drafts, setDrafts] = useState<SampleFormDraft[]>(() => [
    createEmptyDraft(1, { collected_by: defaultTechnicienId ?? '' }),
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

  const applyBatchCount = useCallback(
    (
      raw: string,
      prevCancelled: CancelledSlot[],
      prevDrafts: SampleFormDraft[],
      prevBatchTotal: number,
    ) => {
      const next = computeBatchState(raw, maxCount, prevCancelled, prevDrafts, prevBatchTotal, defaultTechnicienId)
      setCountInput(String(next.parsed))
      setBatchTotal(next.parsed)
      setCancelledSlots(next.cancelled)
      setDrafts(next.drafts)
      return next
    },
    [defaultTechnicienId, maxCount],
  )

  const handleCountInputChange = (raw: string) => {
    setCountInput(raw.replace(/\D/g, ''))
  }

  const commitCountInput = () => {
    applyBatchCount(countInput || '1', cancelledSlots, drafts, batchTotal)
  }

  const handleCountKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitCountInput()
    }
  }

  const updateDraft = (receptionIndex: number, patch: Partial<SampleFormDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.reception_index === receptionIndex ? { ...d, ...patch } : d)),
    )
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

  const handleRemoveDraft = (receptionIndex: number) => {
    const reason = window.prompt(
      `Motif d'annulation de l'étiquette ${receptionIndex}/${batchTotal} (optionnel) :`,
    )
    const slot: CancelledSlot = {
      reception_index: receptionIndex,
      reason: reason?.trim() || 'Annulé avant réception',
    }
    const nextCancelled = [...cancelledSlots.filter((c) => c.reception_index !== receptionIndex), slot]
    setCancelledSlots(nextCancelled)
    setDrafts((prev) => prev.filter((d) => d.reception_index !== receptionIndex))
  }

  const uploadPhotos = async (samples: ReceptionSample[], sourceDrafts: SampleFormDraft[]) => {
    const out: ReceptionSample[] = []
    for (const sample of samples) {
      const draft = sourceDrafts.find((d) => d.reception_index === sample.reception_index)
      let current = sample
      if (draft?.photoFile) {
        await samplesReceptionApi.uploadPhoto(sample.id, draft.photoFile)
        current = await samplesReceptionApi.get(sample.id)
      }
      out.push(current)
    }
    return out.sort((a, b) => (a.reception_index ?? 0) - (b.reception_index ?? 0))
  }

  const handleSubmit = async () => {
    const { parsed: effectiveTotal, cancelled: effectiveCancelled, drafts: effectiveDrafts } =
      applyBatchCount(countInput || '1', cancelledSlots, drafts, batchTotal)

    if (effectiveDrafts.length === 0) {
      setError('Aucun échantillon à réceptionner.')
      return
    }

    setError(null)
    setBusy(true)
    try {
      let samples: ReceptionSample[] = []

      if (isFromLine && line) {
        const res = await samplesReceptionApi.receiveBatchFromLine({
          bon_commande_ligne_id: line.id,
          batch_total: effectiveTotal,
          samples: effectiveDrafts.map((d) => draftToReceiveBody(d, effectiveTotal)),
          cancelled_slots: effectiveCancelled.length > 0 ? effectiveCancelled : undefined,
        })
        samples = res.data
      } else if (transitSample) {
        const body: ReceiveSampleBody = {
          ...draftToReceiveBody(drafts[0]),
        }
        samples = [await samplesReceptionApi.receive(transitSample.id, body)]
      } else {
        throw new Error('Contexte réception invalide.')
      }

      samples = await uploadPhotos(samples, effectiveDrafts)
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

  const clampedHint =
    isFromLine && parseInt(countInput, 10) > maxCount
      ? `Limité à ${maxCount} échantillons par lot.`
      : null

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      {isFromLine && line && step !== 'done' && (
        <p className="text-muted sample-reception-intro">
          BC {line.bon_commande?.numero ?? '—'} · {line.chantier?.name ?? '—'} · {line.dossier?.reference ?? '—'}
          <br />
          Reste à recevoir : <strong>{line.quantite_manquante}</strong> / {line.quantite_attendue}
        </p>
      )}

      {step === 'forms' && (
        <>
          {isFromLine && (
            <div className="sample-reception-count">
              <label>
                <span className="sample-reception-count__label">Nombre d&apos;échantillons / étiquettes</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={countInput}
                  onChange={(e) => handleCountInputChange(e.target.value)}
                  onBlur={commitCountInput}
                  onKeyDown={handleCountKeyDown}
                  aria-label="Nombre d'échantillons"
                />
              </label>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Saisissez le nombre puis cliquez en dehors du champ ou appuyez sur Entrée pour générer les formulaires.
                {drafts.length > 0 && (
                  <>
                    {' '}
                    {drafts.length} formulaire{drafts.length > 1 ? 's' : ''} actif{drafts.length > 1 ? 's' : ''} sur{' '}
                    {batchTotal} étiquette{batchTotal > 1 ? 's' : ''} (max. {maxCount}).
                  </>
                )}
              </p>
              {clampedHint && <p className="error" style={{ fontSize: '0.85rem' }}>{clampedHint}</p>}
              {cancelledSlots.length > 0 && (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Étiquettes annulées (historisées) :{' '}
                  {cancelledSlots.map((c) => `${c.reception_index}/${batchTotal}`).join(', ')}
                </p>
              )}
            </div>
          )}

          {isFromLine && drafts.length > 1 && (
            <div className="sample-reception-toolbar">
              <button type="button" className="btn btn-secondary btn-sm" onClick={applyCommonToAll}>
                Appliquer échantillon 1 à tous
              </button>
            </div>
          )}

          <div className="sample-reception-forms">
            {drafts.map((draft) => (
              <SampleFormCard
                key={draft.key}
                draft={draft}
                batchTotal={batchTotal}
                users={users}
                showType={isFromLine}
                canRemove={isFromLine && batchTotal > 1}
                onChange={(patch) => updateDraft(draft.reception_index, patch)}
                onRemove={() => handleRemoveDraft(draft.reception_index)}
              />
            ))}
          </div>

          {error && <p className="error">{error}</p>}

          <div className="sample-reception-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
              Fermer
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || drafts.length === 0}
              onClick={() => void handleSubmit()}
            >
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
                {s.reception_index && s.reception_batch_total && (
                  <span className="text-muted"> · {s.reception_index}/{s.reception_batch_total}</span>
                )}
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
