import { useMemo, useState } from 'react'
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
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['odm-jalons-generation', bcId],
    queryFn: () => ordresMissionApi.getBonCommandeLignesForGeneration(bcId),
    enabled: bcId > 0,
  })

  const jalons = data?.jalons ?? []

  const generateMut = useMutation({
    mutationFn: () => {
      if (selectedLineIds.size === 0) {
        throw new Error('Sélectionnez au moins un jalon pour générer.')
      }
      return ordresMissionApi.generateFromBC(bcId, Array.from(selectedLineIds))
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
    return jalons
      .filter((j) => selectedLineIds.has(j.id))
      .reduce((sum, j) => sum + j.quantite_restante, 0)
  }, [jalons, selectedLineIds])

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedLineIds(new Set(jalons.map((j) => j.id)))
    } else {
      setSelectedLineIds(new Set())
    }
  }

  const toggleJalon = (jalonId: number) => {
    const next = new Set(selectedLineIds)
    if (next.has(jalonId)) {
      next.delete(jalonId)
    } else {
      next.add(jalonId)
    }
    setSelectedLineIds(next)
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
    <Modal title="Générer ordres de mission — Sélection des jalons" onClose={() => { if (!generateMut.isPending) onClose() }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* En-tête avec bouton "Tout sélectionner" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
          <input
            type="checkbox"
            checked={selectedLineIds.size === jalons.length && jalons.length > 0}
            ref={(el) => {
              if (el) {
                el.indeterminate = selectedLineIds.size > 0 && selectedLineIds.size < jalons.length
              }
            }}
            onChange={(e) => toggleAll(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label style={{ fontWeight: 600, cursor: 'pointer', flex: 1, margin: 0 }}>
            Sélectionner tout ({jalons.length} jalon{jalons.length !== 1 ? 's' : ''})
          </label>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>
            {selectedLineIds.size > 0 && `${selectedLineIds.size} sélectionné${selectedLineIds.size !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Liste des jalons */}
        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {jalons.map((jalon) => {
            const isSelected = selectedLineIds.has(jalon.id)
            const canSelect = jalon.quantite_restante > 0
            return (
              <div
                key={jalon.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: 6,
                  border: `1px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                  background: isSelected ? '#eff6ff' : '#f9fafb',
                  cursor: canSelect ? 'pointer' : 'not-allowed',
                  opacity: canSelect ? 1 : 0.6,
                }}
                onClick={() => canSelect && toggleJalon(jalon.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!canSelect}
                    onChange={() => canSelect && toggleJalon(jalon.id)}
                    style={{ marginTop: '0.2rem', cursor: canSelect ? 'pointer' : 'not-allowed' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                      {jalon.article ? (
                        <>
                          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                            [{jalon.article.code}]
                          </span>{' '}
                          {jalon.article.libelle}
                        </>
                      ) : (
                        jalon.libelle
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', gap: '1rem' }}>
                      <span>
                        Total:{' '}
                        <strong style={{ color: '#1f2937' }}>
                          {formatQuantity(jalon.quantite_totale)} unité{jalon.quantite_totale !== 1 ? 's' : ''}
                        </strong>
                      </span>
                      {jalon.quantite_generee > 0 && (
                        <span>
                          Généré:{' '}
                          <strong style={{ color: '#10b981' }}>
                            {formatQuantity(jalon.quantite_generee)}
                          </strong>
                        </span>
                      )}
                      <span>
                        Reste:{' '}
                        <strong style={{ color: canSelect ? '#ef4444' : '#6b7280' }}>
                          {formatQuantity(jalon.quantite_restante)}
                        </strong>
                      </span>
                    </div>
                    {jalon.date_debut_prevue && (
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.3rem' }}>
                        {new Date(jalon.date_debut_prevue).toLocaleDateString('fr-FR')}
                        {jalon.date_fin_prevue &&
                          ` → ${new Date(jalon.date_fin_prevue).toLocaleDateString('fr-FR')}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Résumé */}
        {selectedLineIds.size > 0 && (
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
              {selectedLineIds.size} jalon{selectedLineIds.size !== 1 ? 's' : ''} sélectionné{selectedLineIds.size !== 1 ? 's' : ''} —{' '}
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
            disabled={selectedLineIds.size === 0 || generateMut.isPending}
            onClick={() => generateMut.mutate()}
          >
            {generateMut.isPending ? 'Génération…' : `Générer (${selectedLineIds.size})`}
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
