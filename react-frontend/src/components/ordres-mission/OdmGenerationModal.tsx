import { useMemo, useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '../Modal'
import { ordresMissionApi, type OdmJalon } from '../../api/client'
import Toast, { toastErrorMessage, type ToastVariant } from '../Toast'
import { formatQuantity } from '../../lib/appLocale'
import { buildBcLigneDisplayRows } from '../../lib/bcLigneDisplay'

type Props = {
  bcId: number
  onClose: () => void
  onSuccess: () => void
}

export default function OdmGenerationModal({ bcId, onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const [selections, setSelections] = useState<Map<number, number>>(new Map())
  const [expandedJalonKeys, setExpandedJalonKeys] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [displayCount, setDisplayCount] = useState(15)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['odm-jalons-generation', bcId],
    queryFn: () => ordresMissionApi.getBonCommandeLignesForGeneration(bcId),
    enabled: bcId > 0,
  })

  const allLignes = data?.jalons ?? []
  const lignesById = useMemo(() => new Map(allLignes.map((l) => [l.id, l])), [allLignes])

  // Regroupe par jalon devis (product_ref_article_ids), comme le PDF BC/devis —
  // PAS par texte de libellé : une même action ("Déplacement de technicien"...)
  // revient dans plusieurs jalons différents avec des quantités différentes.
  const displayRows = useMemo(
    () => buildBcLigneDisplayRows<OdmJalon>(allLignes, data?.devis_display_meta),
    [allLignes, data?.devis_display_meta],
  )

  type TopRow =
    | { kind: 'jalon'; id: string; label: string; code?: string | null; childIds: number[] }
    | { kind: 'product'; id: string; ligne: OdmJalon }

  const topRows: TopRow[] = useMemo(
    () =>
      displayRows
        .filter((row) => row.type === 'jalon_header' || !row.nested)
        .map((row) =>
          row.type === 'jalon_header'
            ? { kind: 'jalon' as const, id: row.key, label: row.label, code: row.code, childIds: row.ligneIds }
            : { kind: 'product' as const, id: row.key, ligne: row.ligne },
        ),
    [displayRows],
  )

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollHeight - scrollTop - clientHeight < 200 && displayCount < topRows.length) {
        setDisplayCount(prev => Math.min(prev + 10, topRows.length))
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [displayCount, topRows.length])

  const displayedRows = topRows.slice(0, displayCount)

  const generateMut = useMutation({
    mutationFn: () => {
      if (selections.size === 0) {
        throw new Error('Sélectionnez au moins un produit pour générer.')
      }
      const selectedLineIds = Array.from(selections.keys())
      return ordresMissionApi.generateFromBC(bcId, selectedLineIds)
    },
    onSuccess: () => {
      setToast({ message: 'Ordres de mission générées avec succès!', variant: 'success' })
      void qc.invalidateQueries({ queryKey: ['ordres-mission'] })
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    },
    onError: (err) => {
      setToast({ message: toastErrorMessage(err, 'Erreur lors de la génération.'), variant: 'error' })
    },
  })

  const totalSelectedQty = useMemo(() => {
    return Array.from(selections.values()).reduce((sum, qty) => sum + qty, 0)
  }, [selections])

  const toggleJalon = (key: string) => {
    setExpandedJalonKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const updateQuantite = (ligneId: number, qty: number) => {
    const ligne = lignesById.get(ligneId)
    if (!ligne) return

    setSelections((prev) => {
      const next = new Map(prev)
      const capped = Math.max(0, Math.min(qty, ligne.quantite_restante))
      if (capped > 0) {
        next.set(ligneId, capped)
      } else {
        next.delete(ligneId)
      }
      return next
    })
  }

  // Applique la MÊME quantité à chaque ligne du jalon (ce ne sont pas des parts
  // d'un total à répartir : chaque ligne est une action répétée N fois, comme
  // le jalon lui-même — cf. la structure du BDC, pas une addition de lignes).
  const applyJalonQty = (childIds: number[], qty: number) => {
    setSelections((prev) => {
      const next = new Map(prev)
      for (const id of childIds) {
        const ligne = lignesById.get(id)
        if (!ligne) continue
        const capped = Math.max(0, Math.min(qty, ligne.quantite_restante))
        if (capped > 0) {
          next.set(id, capped)
        } else {
          next.delete(id)
        }
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <Modal title="Générer ordres de mission — Sélection des jalons" onClose={onClose}>
        <p className="text-muted">Chargement des jalons…</p>
      </Modal>
    )
  }

  if (error || !data) {
    return (
      <Modal title="Générer ordres de mission — Sélection des jalons" onClose={onClose}>
        <p className="error">{(error as Error)?.message ?? 'Impossible de charger les jalons.'}</p>
      </Modal>
    )
  }

  if (allLignes.length === 0) {
    return (
      <Modal title="Générer ordres de mission — Sélection des jalons" onClose={onClose}>
        <p className="text-muted">Ce bon de commande ne contient aucune ligne.</p>
      </Modal>
    )
  }

  return (
    <Modal size="xl" title="Générer ordres de mission — Sélection des jalons" onClose={() => { if (!generateMut.isPending) onClose() }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Liste des jalons dépliables */}
        <div ref={scrollContainerRef} style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayedRows.map((row) => {
            if (row.kind === 'product') {
              const ligne = row.ligne
              const selectedQty = selections.get(ligne.id) ?? 0
              const isLineSelected = selectedQty > 0
              const canSelect = ligne.quantite_restante > 0

              return (
                <div
                  key={row.id}
                  style={{
                    borderRadius: 6,
                    border: `1px solid ${isLineSelected ? '#10b981' : '#e5e7eb'}`,
                    background: isLineSelected ? '#f0fdf4' : '#f9fafb',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    justifyContent: 'space-between',
                    minHeight: '55px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={isLineSelected}
                      onChange={(e) => updateQuantite(ligne.id, e.target.checked ? Math.max(0, ligne.quantite_restante) : 0)}
                      style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer', flexShrink: 0, accentColor: '#10b981' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1f2937' }}>
                        {ligne.article ? (
                          <>
                            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>[{ligne.article.code}]</span>{' '}
                            {ligne.article.libelle}
                          </>
                        ) : (
                          ligne.libelle
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', background: '#e5e7eb', padding: '0.25rem 0.5rem', borderRadius: 3, color: '#374151' }}>
                          BC: <strong>{formatQuantity(ligne.quantite_totale)}</strong>
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#dbeafe', padding: '0.25rem 0.5rem', borderRadius: 3, color: '#1e40af' }}>
                          OM: <strong>{formatQuantity(ligne.quantite_generee)}</strong>
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: 3, color: canSelect ? '#7f1d1d' : '#9ca3af' }}>
                          Reste: <strong>{formatQuantity(ligne.quantite_restante)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <input
                      type="number"
                      min={0}
                      max={ligne.quantite_restante}
                      value={selectedQty}
                      onChange={(e) => updateQuantite(ligne.id, Number(e.target.value) || 0)}
                      placeholder="0"
                      style={{ width: '70px', padding: '0.4rem 0.5rem', borderRadius: 3, border: `1px solid ${isLineSelected ? '#10b981' : '#d1d5db'}`, fontSize: '0.9rem', fontFamily: 'inherit', textAlign: 'center', fontWeight: 600 }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>/ {formatQuantity(ligne.quantite_restante)}</span>
                  </div>
                </div>
              )
            }

            // row.kind === 'jalon' : quantité = celle de la ligne représentative (BDC),
            // JAMAIS la somme des lignes du jalon (elles partagent la même quantité).
            const isJalonExpanded = expandedJalonKeys.has(row.id)
            const refLigne = lignesById.get(row.childIds[0])
            const jalonQtyBc = refLigne?.quantite_totale ?? 0
            const jalonQtyOm = refLigne?.quantite_generee ?? 0
            const jalonQtyReste = refLigne?.quantite_restante ?? 0
            const jalonTotalQty = refLigne ? (selections.get(refLigne.id) ?? 0) : 0
            const jalonSelected = jalonTotalQty > 0

            return (
              <div key={row.id}>
                {/* NIVEAU 1: JALON */}
                <div
                  style={{
                    borderRadius: 6,
                    border: `1px solid ${jalonSelected ? '#3b82f6' : '#e5e7eb'}`,
                    background: jalonSelected ? '#eff6ff' : '#f9fafb',
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    justifyContent: 'space-between',
                    minHeight: '55px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    {/* Checkbox sélectionner tout le jalon (même quantité sur chaque produit) */}
                    <input
                      type="checkbox"
                      checked={jalonSelected}
                      onChange={(e) => applyJalonQty(row.childIds, e.target.checked ? jalonQtyReste : 0)}
                      style={{
                        width: '1.2rem',
                        height: '1.2rem',
                        cursor: 'pointer',
                        flexShrink: 0,
                        accentColor: '#3b82f6',
                      }}
                    />
                    {/* Expand button */}
                    <button
                      type="button"
                      onClick={() => toggleJalon(row.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '0.8rem',
                        color: '#6b7280',
                        flexShrink: 0,
                        width: '1rem',
                        height: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isJalonExpanded ? '▼' : '▶'}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1f2937', marginBottom: '0.4rem' }}>
                        📋 {row.label}{row.code ? <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.8rem' }}> [{row.code}]</span> : null}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', background: '#e5e7eb', padding: '0.25rem 0.5rem', borderRadius: 3, color: '#374151' }}>
                          BC: <strong>{formatQuantity(jalonQtyBc)}</strong>
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#dbeafe', padding: '0.25rem 0.5rem', borderRadius: 3, color: '#1e40af' }}>
                          OM: <strong>{formatQuantity(jalonQtyOm)}</strong>
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: 3, color: '#7f1d1d' }}>
                          Reste: <strong>{formatQuantity(jalonQtyReste)}</strong>
                        </span>
                        {jalonTotalQty > 0 && (
                          <span style={{ fontSize: '0.75rem', background: '#cffafe', padding: '0.25rem 0.5rem', borderRadius: 3, color: '#0e7490', fontWeight: 600 }}>
                            → À générer: {formatQuantity(jalonTotalQty)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <input
                      type="number"
                      min={0}
                      max={jalonQtyReste}
                      value={jalonTotalQty}
                      onChange={(e) => applyJalonQty(row.childIds, Number(e.target.value) || 0)}
                      placeholder="0"
                      title="Quantité à générer pour ce jalon (appliquée à chaque produit du jalon)"
                      style={{
                        width: '70px',
                        padding: '0.4rem 0.5rem',
                        borderRadius: 3,
                        border: `1px solid ${jalonSelected ? '#3b82f6' : '#d1d5db'}`,
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        fontWeight: 600,
                        color: jalonSelected ? '#1e40af' : '#1f2937',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      / {formatQuantity(jalonQtyReste)}
                    </span>
                  </div>
                </div>

                {/* NIVEAU 2: PRODUITS DU JALON */}
                {isJalonExpanded && (
                  <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {row.childIds.map((childId) => {
                      const ligne = lignesById.get(childId)
                      if (!ligne) return null
                      const selectedQty = selections.get(ligne.id) ?? 0
                      const isLineSelected = selectedQty > 0
                      const canSelect = ligne.quantite_restante > 0

                      return (
                        <div
                          key={ligne.id}
                          style={{
                            borderRadius: 4,
                            border: `1px solid ${isLineSelected ? '#10b981' : '#d1d5db'}`,
                            background: isLineSelected ? '#f0fdf4' : '#ffffff',
                            padding: '0.6rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isLineSelected}
                              onChange={(e) => {
                                updateQuantite(ligne.id, e.target.checked ? Math.max(0, ligne.quantite_restante) : 0)
                              }}
                              style={{
                                width: '1.1rem',
                                height: '1.1rem',
                                cursor: 'pointer',
                                flexShrink: 0,
                                accentColor: '#10b981',
                              }}
                            />
                            {/* Produit info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1f2937' }}>
                                {ligne.article ? (
                                  <>
                                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                                      [{ligne.article.code}]
                                    </span>{' '}
                                    {ligne.article.libelle}
                                  </>
                                ) : (
                                  ligne.libelle
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                BC: {formatQuantity(ligne.quantite_totale)} | OM: {formatQuantity(ligne.quantite_generee ?? 0)} | Dispo: <strong style={{ color: canSelect ? '#dc2626' : '#9ca3af' }}>{formatQuantity(ligne.quantite_restante)}</strong>
                              </div>
                            </div>
                          </div>
                          {/* Champ quantité */}
                          <input
                            type="number"
                            min={0}
                            max={ligne.quantite_restante}
                            value={selectedQty}
                            onChange={(e) => updateQuantite(ligne.id, Number(e.target.value) || 0)}
                            placeholder="0"
                            style={{
                              width: '60px',
                              padding: '0.4rem 0.5rem',
                              borderRadius: 3,
                              border: '1px solid #d1d5db',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit',
                              textAlign: 'center',
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {displayCount < topRows.length && (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
              ↓ Scroll pour charger {topRows.length - displayCount} élément{topRows.length - displayCount > 1 ? 's' : ''} supplémentaire{topRows.length - displayCount > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Résumé */}
        {selections.size > 0 && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              background: '#f0fdf4',
              borderLeft: '4px solid #10b981',
              fontSize: '0.9rem',
            }}
          >
            <strong style={{ color: '#10b981' }}>
              {selections.size} produit{selections.size !== 1 ? 's' : ''} sélectionné{selections.size !== 1 ? 's' : ''} —{' '}
              {formatQuantity(totalSelectedQty)} unité{totalSelectedQty !== 1 ? 's' : ''} à générer
            </strong>
          </div>
        )}

        {/* Erreurs */}
        {generateMut.isError && (
          <p className="error" style={{ margin: 0 }}>
            {(generateMut.error as Error).message}
          </p>
        )}

        {/* Actions */}
        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selections.size === 0 || generateMut.isPending}
            onClick={() => generateMut.mutate()}
          >
            {generateMut.isPending ? 'Génération…' : `Générer (${selections.size})`}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={generateMut.isPending}
            onClick={onClose}
          >
            Annuler
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
        )}
      </div>
    </Modal>
  )
}
