/**
 * Réception Laboratoire — produits attendus depuis les BC confirmés
 * et échantillons FOLD (création, réception, étiquettes QR / code-barres).
 */
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  labReceptionApi,
  samplesReceptionApi,
  type LabReceptionAttendu,
  type ReceptionSample,
  type SampleLabelData,
} from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import SampleReceptionModal, { type ReceptionMode } from '../../components/labo/SampleReceptionModal'
import SampleLabelPrint, { type LabelFormat } from '../../components/labo/SampleLabelPrint'

type AttenduFilter = 'all' | 'pending' | 'complete'

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function ProgressCell({ row }: { row: LabReceptionAttendu }) {
  const { quantite_recue, quantite_en_transit, quantite_attendue, quantite_manquante } = row
  const done = quantite_recue + quantite_en_transit
  const pct = quantite_attendue > 0 ? Math.min(100, Math.round((done / quantite_attendue) * 100)) : 0

  return (
    <div>
      <div style={{ fontWeight: 600 }}>
        {formatQty(quantite_recue)}
        {quantite_en_transit > 0 && (
          <span style={{ color: '#d97706', fontWeight: 500 }}>
            {' '}
            + {formatQty(quantite_en_transit)} en transit
          </span>
        )}
        <span style={{ color: '#6b7280', fontWeight: 400 }}> / {formatQty(quantite_attendue)}</span>
      </div>
      <div
        style={{
          marginTop: 4,
          height: 4,
          borderRadius: 2,
          background: '#e5e7eb',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: row.reception_complete ? '#10b981' : '#3b82f6',
          }}
        />
      </div>
      {quantite_manquante > 0 && !row.reception_complete && (
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
          {formatQty(quantite_manquante)} manquant(s)
        </div>
      )}
    </div>
  )
}

export default function LaboReceptionPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [foldSearch, setFoldSearch] = useState('')
  const [attenduFilter, setAttenduFilter] = useState<AttenduFilter>('pending')
  const [receptionMode, setReceptionMode] = useState<ReceptionMode | null>(null)
  const [labelData, setLabelData] = useState<SampleLabelData | null>(null)
  const [labelFormat, setLabelFormat] = useState<LabelFormat>('a6')
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null)

  const { data: attendusRes, isLoading: loadingAttendus } = useQuery({
    queryKey: ['lab-reception', 'attendus', search],
    queryFn: () => labReceptionApi.attendus({ search: search || undefined }),
    staleTime: 30_000,
  })

  const { data: enTransitRes, isLoading: loadingTransit } = useQuery({
    queryKey: ['lab-reception', 'samples', 'en_transit'],
    queryFn: () => samplesReceptionApi.list({ status: 'en_transit', per_page: 100 }),
    staleTime: 15_000,
  })

  const { data: receivedRes, isLoading: loadingReceived } = useQuery({
    queryKey: ['lab-reception', 'samples', 'receptionne', foldSearch],
    queryFn: () =>
      samplesReceptionApi.list({
        status: 'receptionne',
        fold: foldSearch || undefined,
        per_page: 100,
      }),
    staleTime: 15_000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => samplesReceptionApi.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lab-reception'] }),
  })

  const attendus = attendusRes?.data ?? []
  const stats = attendusRes?.stats
  const enTransit = enTransitRes?.data ?? []
  const received = receivedRes?.data ?? []

  const filteredAttendus = useMemo(() => {
    return attendus.filter((row) => {
      if (attenduFilter === 'pending') return !row.reception_complete
      if (attenduFilter === 'complete') return row.reception_complete
      return true
    })
  }, [attendus, attenduFilter])

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['lab-reception'] })
  }

  const openLabel = async (sampleId: number) => {
    const data = await samplesReceptionApi.labelData(sampleId)
    setLabelData(data)
  }

  const handleReceptionSuccess = async (sample: ReceptionSample) => {
    setReceptionMode(null)
    invalidateAll()
    try {
      await openLabel(sample.id)
    } catch {
      // étiquette optionnelle si erreur
    }
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Laboratoire', to: '/labo' },
        { label: 'Réception' },
      ]}
      moduleBarLabel="Laboratoire — Réception"
      title="Réception Laboratoire"
      subtitle="Lignes de BC confirmés prêtes pour la réception terrain"
    >
      <p className="text-muted" style={{ marginBottom: '1.25rem', maxWidth: 720, lineHeight: 1.5 }}>
        Réceptionnez les échantillons depuis les lignes de bon de commande (issues des devis signés).
        Chaque réception génère un numéro FOLD, un numéro transco (code-barres) et une étiquette QR (A6 ou A5).
      </p>

      {stats && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {[
            { label: 'Produits en attente', value: stats.produits_en_attente, color: '#d97706', bg: '#fef3c7' },
            { label: 'Essais attendus', value: stats.essais_attendus, color: '#3b82f6', bg: '#dbeafe' },
            { label: 'Essais reçus', value: stats.essais_recus, color: '#10b981', bg: '#d1fae5' },
            { label: 'En transit', value: stats.essais_en_transit, color: '#8b5cf6', bg: '#ede9fe' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ flex: '1 1 140px', padding: '0.75rem 1rem', borderRadius: 8, background: bg }}>
              <div style={{ fontWeight: 700, color, fontSize: '1.4rem' }}>{value}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Rechercher BC, chantier, dossier, produit, technicien…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 260px', maxWidth: 400 }}
        />
        <select
          value={attenduFilter}
          onChange={(e) => setAttenduFilter(e.target.value as AttenduFilter)}
          style={{ flex: '1 1 180px', maxWidth: 220 }}
        >
          <option value="pending">En attente de réception</option>
          <option value="all">Tous les produits</option>
          <option value="complete">Réception complète</option>
        </select>
        {(search || attenduFilter !== 'pending') && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch('')
              setAttenduFilter('pending')
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Produits attendus</h2>
      {loadingAttendus && <p>Chargement…</p>}
      {!loadingAttendus && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Produit / Essai</th>
                  <th className="data-table__code">BC</th>
                  <th className="data-table__reference">Chantier / Dossier</th>
                  <th>Technicien</th>
                  <th className="data-table__num">Réception</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendus.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                      Aucun produit en attente de réception.
                    </td>
                  </tr>
                )}
                {filteredAttendus.map((row) => (
                  <Fragment key={row.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.libelle}</div>
                        {row.article && (
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>[{row.article.code}]</div>
                        )}
                      </td>
                      <td className="data-table__code">
                        {row.bon_commande ? (
                          <Link to={`/bons-commande/${row.bon_commande.id}`} className="link-inline">
                            {row.bon_commande.numero}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {row.client && (
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{row.client.name}</div>
                        )}
                      </td>
                      <td className="data-table__reference">
                        {row.chantier?.name ?? <span className="text-muted">—</span>}
                        {row.dossier && (
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            {row.dossier.reference}
                            {row.dossier.titre ? ` · ${row.dossier.titre}` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.88rem' }}>{row.technicien?.name ?? '—'}</td>
                      <td className="data-table__num">
                        <ProgressCell row={row} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {!row.reception_complete && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => setReceptionMode({ kind: 'from_line', line: row })}
                            >
                              Réception
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setExpandedLineId(expandedLineId === row.id ? null : row.id)}
                          >
                            {expandedLineId === row.id ? 'Masquer' : 'Historique'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedLineId === row.id && (
                      <tr>
                        <td colSpan={6} style={{ background: '#f9fafb', padding: '0.75rem 1rem' }}>
                          <LineSamplesHistory lineId={row.id} onPrintLabel={(id) => void openLabel(id)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Échantillons en transit (FOLD)</h2>
      {loadingTransit && <p>Chargement…</p>}
      {!loadingTransit && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th className="data-table__code">FOLD</th>
                  <th>Produit</th>
                  <th className="data-table__reference">Dossier</th>
                  <th>Prélevé par</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enTransit.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                      Aucun échantillon en transit.
                    </td>
                  </tr>
                )}
                {enTransit.map((sample) => (
                  <tr key={sample.id}>
                    <td className="data-table__code" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {sample.fold_number ?? '—'}
                    </td>
                    <td>
                      {sample.product?.libelle ?? sample.bon_commande_ligne?.libelle ?? '—'}
                      {sample.product?.code && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>[{sample.product.code}]</div>
                      )}
                    </td>
                    <td className="data-table__reference" style={{ fontSize: '0.88rem' }}>
                      {sample.dossier?.reference ?? '—'}
                    </td>
                    <td style={{ fontSize: '0.88rem' }}>{sample.collected_by?.name ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setReceptionMode({ kind: 'transit', sample })}
                      >
                        Réceptionner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Échantillons réceptionnés</h2>
        <input
          type="text"
          placeholder="Rechercher FOLD ou transco…"
          value={foldSearch}
          onChange={(e) => setFoldSearch(e.target.value)}
          style={{ flex: '1 1 200px', maxWidth: 280 }}
          className="btn-sm"
        />
      </div>
      {loadingReceived && <p>Chargement…</p>}
      {!loadingReceived && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th className="data-table__code">FOLD</th>
                  <th className="data-table__code">Transco</th>
                  <th>Produit</th>
                  <th>Réception</th>
                  <th>Par / De</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {received.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                      Aucun échantillon réceptionné.
                    </td>
                  </tr>
                )}
                {received.map((sample) => (
                  <tr key={sample.id}>
                    <td className="data-table__code" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {sample.fold_number ?? '—'}
                    </td>
                    <td className="data-table__code" style={{ fontFamily: 'monospace' }}>
                      {sample.transco_number ?? '—'}
                    </td>
                    <td>{sample.product?.libelle ?? sample.bon_commande_ligne?.libelle ?? '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDateTime(sample.received_at)}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div>{sample.received_by?.name ?? '—'}</div>
                      <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                        de {sample.collected_by?.name ?? '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void openLabel(sample.id)}
                        >
                          Étiquette
                        </button>
                        {sample.photo_path && (
                          <a
                            href={samplesReceptionApi.photoUrl(sample.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Photo
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={deleteMut.isPending}
                          onClick={() => {
                            if (window.confirm(`Supprimer l'échantillon ${sample.fold_number} ?`)) {
                              deleteMut.mutate(sample.id)
                            }
                          }}
                        >
                          Suppr.
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {receptionMode && (
        <SampleReceptionModal
          mode={receptionMode}
          onClose={() => setReceptionMode(null)}
          onSuccess={(s) => void handleReceptionSuccess(s)}
        />
      )}

      {labelData && (
        <SampleLabelPrint
          label={labelData}
          format={labelFormat}
          onFormatChange={setLabelFormat}
          onClose={() => setLabelData(null)}
        />
      )}
    </ModuleEntityShell>
  )
}

function LineSamplesHistory({
  lineId,
  onPrintLabel,
}: {
  lineId: number
  onPrintLabel: (id: number) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['lab-reception', 'line-samples', lineId],
    queryFn: () => samplesReceptionApi.list({ bon_commande_ligne_id: lineId, per_page: 50 }),
  })
  const samples = data?.data ?? []

  if (isLoading) return <p className="text-muted">Chargement…</p>
  if (samples.length === 0) return <p className="text-muted">Aucun échantillon pour cette ligne.</p>

  return (
    <table className="data-table data-table--compact" style={{ fontSize: '0.85rem' }}>
      <thead>
        <tr>
          <th>FOLD</th>
          <th>Transco</th>
          <th>Statut</th>
          <th>Réception</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {samples.map((s) => (
          <tr key={s.id}>
            <td style={{ fontFamily: 'monospace' }}>{s.fold_number ?? '—'}</td>
            <td style={{ fontFamily: 'monospace' }}>{s.transco_number ?? '—'}</td>
            <td>{s.status}</td>
            <td>{formatDateTime(s.received_at)}</td>
            <td>
              {s.transco_number && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPrintLabel(s.id)}>
                  Étiquette
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
