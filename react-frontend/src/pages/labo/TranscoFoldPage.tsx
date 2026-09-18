/**
 * Transco FOLD — Carte d'identité échantillon
 * Scan ou saisie d'un numéro FOLD / transco / code-barres → fiche client complète.
 */
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { samplesReceptionApi, type ReceptionSample } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { parseSampleQrContent } from '../../lib/sampleQr'

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  en_transit:  { label: 'En transit',  color: '#d97706', bg: '#fef3c7' },
  receptionne: { label: 'Réceptionné', color: '#3b82f6', bg: '#dbeafe' },
  imprime:     { label: 'Imprimé',     color: '#0891b2', bg: '#cffafe' },
  stocke:      { label: 'Stocké',      color: '#059669', bg: '#d1fae5' },
  en_essai:    { label: 'En essai',    color: '#7c3aed', bg: '#ede9fe' },
  termine:     { label: 'Terminé',     color: '#10b981', bg: '#d1fae5' },
  rejete:      { label: 'Rejeté',      color: '#dc2626', bg: '#fee2e2' },
  perdu:       { label: 'Perdu',       color: '#ea580c', bg: '#ffedd5' },
  archive:     { label: 'Archivé',     color: '#6366f1', bg: '#e0e7ff' },
  annule:      { label: 'Annulé',      color: '#6b7280', bg: '#f3f4f6' },
}

function statusInfo(status: string) {
  return STATUS_INFO[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' }
}

function fmt(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ minWidth: 140, fontWeight: 600, fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.92rem', color: value ? '#111827' : '#9ca3af' }}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function SampleCard({ sample }: { sample: ReceptionSample }) {
  const si = statusInfo(sample.status)
  const bc = sample.bon_commande_ligne?.bon_commande
  const client = bc?.client
  const dossier = sample.dossier ?? bc?.dossier

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${si.color}`,
        padding: '1.25rem 1.5rem',
        marginBottom: '1rem',
        maxWidth: 640,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>
            {sample.fold_number ?? '—'}
          </div>
          {sample.transco_number && (
            <div style={{ fontFamily: 'monospace', fontSize: '1rem', color: '#6b7280' }}>
              Transco : {sample.transco_number}
            </div>
          )}
          {sample.reception_index && sample.reception_batch_total && (
            <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: 2 }}>
              Échantillon {sample.reception_index} / {sample.reception_batch_total}
            </div>
          )}
        </div>
        <span
          style={{
            padding: '4px 14px',
            borderRadius: 20,
            background: si.bg,
            color: si.color,
            fontWeight: 700,
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
          {si.label}
        </span>
      </div>

      {/* Client section */}
      {client && (
        <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', border: '1px solid #bae6fd' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0369a1' }}>{client.name}</div>
          {client.email && <div style={{ fontSize: '0.85rem', color: '#0369a1' }}>{client.email}</div>}
          {client.phone && <div style={{ fontSize: '0.85rem', color: '#0369a1' }}>{client.phone}</div>}
        </div>
      )}

      {/* Details */}
      <InfoRow label="Produit / Essai" value={sample.product?.libelle ?? sample.bon_commande_ligne?.libelle} />
      {sample.product?.code && <InfoRow label="Code produit" value={sample.product.code} />}
      <InfoRow label="Bon de commande" value={bc?.numero} />
      <InfoRow
        label="Dossier"
        value={dossier ? `${dossier.reference}${dossier.titre ? ` — ${dossier.titre}` : ''}` : null}
      />
      {sample.sample_type && <InfoRow label="Type d'essai" value={sample.sample_type} />}
      {sample.origin_location && <InfoRow label="Origine / Lieu" value={sample.origin_location} />}
      {sample.condition_state && <InfoRow label="État" value={sample.condition_state} />}
      {sample.storage_location && <InfoRow label="Emplacement stockage" value={sample.storage_location} />}
      {sample.depth_m != null && <InfoRow label="Profondeur" value={`${sample.depth_m} m`} />}
      {sample.weight_g != null && <InfoRow label="Masse" value={`${sample.weight_g} g`} />}
      <InfoRow label="Prélevé par" value={sample.collected_by?.name} />
      <InfoRow label="Prélevé le" value={fmt(sample.collected_at)} />
      <InfoRow label="Réceptionné par" value={sample.received_by?.name} />
      <InfoRow label="Réceptionné le" value={fmt(sample.received_at)} />
      {sample.notes && <InfoRow label="Notes" value={sample.notes} />}
    </div>
  )
}

export default function TranscoFoldPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['transco-search', submitted],
    queryFn: () => (submitted ? samplesReceptionApi.search(submitted) : Promise.resolve({ data: [] })),
    enabled: Boolean(submitted),
  })

  const samples: ReceptionSample[] = data?.data ?? []

  const handleSearch = () => {
    const trimmed = query.trim()
    if (trimmed.length >= 3) setSubmitted(trimmed)
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Laboratoire', to: '/labo' },
        { label: 'Transco FOLD' },
      ]}
      moduleBarLabel="Laboratoire — Transco FOLD"
      title="Transco FOLD"
      subtitle="Scannez ou saisissez un numéro FOLD, transco ou code-barres pour obtenir la fiche complète de l'échantillon."
    >
      {/* Search bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', maxWidth: 540, flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="FOLD-XXXXXXXX / numéro transco / code-barres…"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            const parsed = parseSampleQrContent(pasted)
            if (parsed && parsed !== pasted.trim()) {
              e.preventDefault()
              setQuery(parsed)
              setTimeout(() => setSubmitted(parsed), 0)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          style={{ flex: '1 1 220px' }}
        />
        <button type="button" className="btn btn-primary" onClick={handleSearch} disabled={query.trim().length < 3}>
          Rechercher
        </button>
        {submitted && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setQuery('')
              setSubmitted('')
              inputRef.current?.focus()
            }}
          >
            ✕ Effacer
          </button>
        )}
      </div>

      {isLoading || isFetching ? (
        <p>Chargement…</p>
      ) : submitted && samples.length === 0 ? (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', maxWidth: 480, color: '#6b7280' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
          <p>Aucun échantillon trouvé pour <strong>{submitted}</strong>.</p>
          <p style={{ fontSize: '0.85rem' }}>
            Vérifiez le numéro FOLD (ex. FOLD-00001234) ou le numéro transco.
          </p>
        </div>
      ) : (
        <>
          {samples.length > 1 && (
            <p className="text-muted" style={{ marginBottom: '0.75rem' }}>
              {samples.length} échantillon(s) trouvé(s) pour «&nbsp;{submitted}&nbsp;»
            </p>
          )}
          {samples.map((s) => (
            <SampleCard key={s.id} sample={s} />
          ))}
        </>
      )}

      {!submitted && (
        <div style={{ marginTop: '2rem', color: '#9ca3af', fontSize: '0.88rem', maxWidth: 480 }}>
          <p>Astuce : en mode scan, le curseur reste dans le champ — scannez directement sans cliquer.</p>
          <p>Le scan QR renseignera automatiquement le numéro FOLD de l'étiquette.</p>
        </div>
      )}
    </ModuleEntityShell>
  )
}
