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

  const jalons = data?.jalons ?? []

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollHeight - scrollTop - clientHeight < 200 && displayCount < jalons.length) {
        setDisplayCount(prev => Math.min(prev + 10, jalons.length))
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [displayCount, jalons.length])

  const displayedJalons = jalons.slice(0, displayCount)

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

  if (jalons.length === 0) {
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
        <div ref={scrollContainerRef} style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {displayedJalons.map((jalon) => {
            const isExpanded = expandedJalons.has(jalon.id)
            const selectedQty = selections.get(jalon.id) ?? 0
            const isSelected = selectedQty > 0
            const canSelect = jalon.quantite_restante > 0

            return (
              <div
                key={jalon.id}
                style={{
                  minHeight: '55px',
                  borderRadius: 6,
                  border: `1px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                  background: isSelected ? '#eff6ff' : '#f9fafb',
                  overflow: 'visible',
                }}
              >
                {/* En-tête jalon (dépliable avec checkbox) */}
                <div
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateQuantite(jalon.id, 1)
                          toggleJalon(jalon.id)
                        } else {
                          updateQuantite(jalon.id, 0)
                        }
                      }}
                      style={{
                        width: '1.1rem',
                        height: '1.1rem',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    {/* Expand/collapse button */}
                    <button
                      type="button"
                      onClick={() => toggleJalon(jalon.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.9rem',
                        color: '#374151',
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    {/* Jalon info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {jalon.article ? (
                          <>
                            <span style={{ color: '#374151', fontSize: '0.85rem' }}>
                              [{jalon.article.code}]
                            </span>{' '}
                            {jalon.article.libelle}
                          </>
                        ) : (
                          jalon.libelle
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        <div>BC: <strong style={{ color: '#1f2937' }}>{formatQuantity(jalon.quantite_totale)}</strong></div>
                        <div>OM: <strong style={{ color: '#1f2937' }}>{formatQuantity(jalon.quantite_generee ?? 0)}</strong></div>
                        <div>Reste: <strong style={{ color: canSelect ? '#ef4444' : '#6b7280' }}>{formatQuantity(jalon.quantite_restante)}</strong></div>
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                      {selectedQty} à générer
                    </span>
                  )}
                </div>

                {/* Contenu dépliable - Détails et quantité */}
                {isExpanded && (
                  <div style={{ padding: '0.75rem', paddingTop: 0, borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                        Article: <span style={{ fontWeight: 600, color: '#1f2937' }}>{jalon.article?.libelle || 'N/A'}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                        <div>BC: {formatQuantity(jalon.quantite_totale)}</div>
                        <div>OM: {formatQuantity(jalon.quantite_generee ?? 0)}</div>
                        <div>Dispo: <strong style={{ color: '#10b981' }}>{formatQuantity(jalon.quantite_restante)}</strong></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
                      <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151' }}>
                          Quantité à générer en OM
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={jalon.quantite_restante}
                          value={selectedQty}
                          onChange={(e) => updateQuantite(jalon.id, Number(e.target.value) || 0)}
                          placeholder="0"
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: 4,
                            border: '1px solid #d1d5db',
                            fontSize: '0.9rem',
                            fontFamily: 'inherit',
                          }}
                        />
                      </label>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        max: {formatQuantity(jalon.quantite_restante)}
                      </div>
                    </div>
                    {selectedQty > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>
                        ✓ {formatQuantity(selectedQty)} sera généré en OM
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {displayCount < jalons.length && (
            <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
              ↓ Scroll pour charger {jalons.length - displayCount} jalon{jalons.length - displayCount > 1 ? 's' : ''} supplémentaire{jalons.length - displayCount > 1 ? 's' : ''}
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
