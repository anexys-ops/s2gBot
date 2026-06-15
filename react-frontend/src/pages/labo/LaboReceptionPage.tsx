/**
 * Réception Laboratoire — produits attendus depuis les BC confirmés
 * et échantillons FOLD en transit.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  labReceptionApi,
  samplesReceptionApi,
  type LabReceptionAttendu,
  type ReceptionSample,
} from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

type AttenduFilter = 'all' | 'pending' | 'complete'

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
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
  const [attenduFilter, setAttenduFilter] = useState<AttenduFilter>('pending')
  const [receiveTarget, setReceiveTarget] = useState<ReceptionSample | null>(null)
  const [conditionState, setConditionState] = useState<'bon' | 'endommage' | 'insuffisant'>('bon')
  const [storageLocation, setStorageLocation] = useState('')

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

  const receiveMut = useMutation({
    mutationFn: (sampleId: number) =>
      samplesReceptionApi.receive(sampleId, {
        condition_state: conditionState,
        storage_location: storageLocation || undefined,
      }),
    onSuccess: () => {
      setReceiveTarget(null)
      setStorageLocation('')
      setConditionState('bon')
      void qc.invalidateQueries({ queryKey: ['lab-reception'] })
    },
  })

  const attendus = attendusRes?.data ?? []
  const stats = attendusRes?.stats
  const enTransit = enTransitRes?.data ?? []

  const filteredAttendus = useMemo(() => {
    return attendus.filter((row) => {
      if (attenduFilter === 'pending') return !row.reception_complete
      if (attenduFilter === 'complete') return row.reception_complete
      return true
    })
  }, [attendus, attenduFilter])

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
        Toutes les lignes d'un BC confirmé (ou en cours) liées à un dossier et un chantier, avec un technicien
        terrain affecté — essais, rapports, lignes catalogue ou texte libre.
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
                  <th>BC</th>
                  <th>Chantier / Dossier</th>
                  <th>Technicien</th>
                  <th className="data-table__num">Réception</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendus.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                      Aucun produit en attente de réception.
                    </td>
                  </tr>
                )}
                {filteredAttendus.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.libelle}</div>
                      {row.article && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>[{row.article.code}]</div>
                      )}
                    </td>
                    <td>
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
                    <td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Échantillons en transit (FOLD)</h2>
      {loadingTransit && <p>Chargement…</p>}
      {!loadingTransit && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>FOLD</th>
                  <th>Produit</th>
                  <th>Dossier</th>
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
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{sample.fold_number ?? '—'}</td>
                    <td>
                      {sample.product?.libelle ?? sample.bonCommandeLigne?.libelle ?? '—'}
                      {sample.product?.code && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>[{sample.product.code}]</div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.88rem' }}>
                      {sample.dossier?.reference ?? '—'}
                    </td>
                    <td style={{ fontSize: '0.88rem' }}>{sample.collectedBy?.name ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setReceiveTarget(sample)}
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

      {receiveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => !receiveMut.isPending && setReceiveTarget(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: '100%', padding: '1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Réceptionner {receiveTarget.fold_number}</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              {receiveTarget.product?.libelle ?? receiveTarget.bonCommandeLigne?.libelle}
            </p>
            <label style={{ display: 'block', marginBottom: '0.75rem' }}>
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
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Emplacement stockage</span>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="Ex. Salle B / Étagère 3"
                style={{ width: '100%' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={receiveMut.isPending}
                onClick={() => setReceiveTarget(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={receiveMut.isPending}
                onClick={() => receiveMut.mutate(receiveTarget.id)}
              >
                {receiveMut.isPending ? '…' : 'Confirmer la réception'}
              </button>
            </div>
            {receiveMut.isError && (
              <p className="error" style={{ marginTop: '0.75rem' }}>
                {(receiveMut.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}
    </ModuleEntityShell>
  )
}
