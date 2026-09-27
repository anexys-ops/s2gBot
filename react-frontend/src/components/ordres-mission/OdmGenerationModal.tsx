import { useMemo, useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '../Modal'
import { ordresMissionApi } from '../../api/client'
import Toast, { toastErrorMessage, type ToastVariant } from '../Toast'
import { formatQuantity } from '../../lib/appLocale'

type Props = {
  bcId: number
  onClose: () => void
  onSuccess: () => void
}

export default function OdmGenerationModal({ bcId, onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const [selections, setSelections] = useState<Map<number, number>>(new Map())
  const [expandedJalons, setExpandedJalons] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [displayCount, setDisplayCount] = useState(15)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['odm-jalons-generation', bcId],
    queryFn: () => ordresMissionApi.getBonCommandeLignesForGeneration(bcId),
    enabled: bcId > 0,
  })

  const allLignes = data?.jalons ?? []

  const groupedByJalon = useMemo(() => {
    const groups: Record<string, typeof allLignes> = {}
    allLignes.forEach(ligne => {
      const jalonName = ligne.libelle || 'Sans jalon'
      if (!groups[jalonName]) groups[jalonName] = []
      groups[jalonName].push(ligne)
    })
    return Object.entries(groups).map(([name, lignes]) => ({
      name,
      lignes,
      id: `jalon-${name}`,
    }))
  }, [allLignes])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollHeight - scrollTop - clientHeight < 200 && displayCount < groupedByJalon.length) {
        setDisplayCount(prev => Math.min(prev + 10, groupedByJalon.length))
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [displayCount, groupedByJalon.length])

  const displayedJalons = groupedByJalon.slice(0, displayCount)

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

  const toggleJalon = (jalonId: number) => {
    const next = new Set(expandedJalons)
    if (next.has(jalonId)) {
      next.delete(jalonId)
    } else {
      next.add(jalonId)
    }
    setExpandedJalons(next)
  }

  const updateQuantite = (jalonId: number, qty: number) => {
    const jalon = jalons.find((j) => j.id === jalonId)
    if (!jalon) return

    const next = new Map(selections)
    if (qty > 0 && qty <= jalon.quantite_restante) {
      next.set(jalonId, qty)
    } else {
      next.delete(jalonId)
    }
    setSelections(next)
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
          {displayedJalons.map((jalonGroup) => {
            const isJalonExpanded = expandedJalons.has(jalonGroup.id)
            const jalonTotalQty = jalonGroup.lignes.reduce((sum, l) => sum + (selections.get(l.id) ?? 0), 0)
            const jalonQtyBc = jalonGroup.lignes.reduce((sum, l) => sum + l.quantite_totale, 0)
            const jalonQtyOm = jalonGroup.lignes.reduce((sum, l) => sum + l.quantite_generee, 0)
            const jalonSelected = jalonTotalQty > 0

            return (
              <div key={jalonGroup.id}>
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
                    {/* Expand button */}
                    <button
                      type="button"
                      onClick={() => toggleJalon(jalonGroup.id)}
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
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1f2937' }}>
                        📋 {jalonGroup.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        BC: <strong>{formatQuantity(jalonQtyBc)}</strong> • OM: <strong>{formatQuantity(jalonQtyOm)}</strong> • Reste: <strong>{formatQuantity(Math.max(0, jalonQtyBc - jalonQtyOm))}</strong>
                      </div>
                    </div>
                  </div>
                  {jalonSelected && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6', whiteSpace: 'nowrap' }}>
                      ✓ {formatQuantity(jalonTotalQty)}
                    </span>
                  )}
                </div>

                {/* NIVEAU 2: PRODUITS DU JALON */}
                {isJalonExpanded && (
                  <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {jalonGroup.lignes.map((ligne) => {
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
                                updateQuantite(ligne.id, e.target.checked ? 1 : 0)
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
                                  'Article'
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
          {displayCount < groupedByJalon.length && (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
              ↓ Scroll pour charger {groupedByJalon.length - displayCount} jalon{groupedByJalon.length - displayCount > 1 ? 's' : ''} supplémentaire{groupedByJalon.length - displayCount > 1 ? 's' : ''}
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
