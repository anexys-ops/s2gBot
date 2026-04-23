import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsLivraisonApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

export default function BonLivraisonFichePage() {
  const { id } = useParams<{ id: string }>()
  const blId = Number(id)
  const { user } = useAuth()
  const qc = useQueryClient()
  const lab = isLab(user?.role)
  const [notes, setNotes] = useState('')
  const [ligneQty, setLigneQty] = useState<Record<number, string>>({})

  const { data: bl, isLoading, error } = useQuery({
    queryKey: ['bon-livraison', blId],
    queryFn: () => bonsLivraisonApi.get(blId),
    enabled: Number.isFinite(blId) && blId > 0,
  })

  useEffect(() => {
    if (!bl) return
    if (typeof bl.notes === 'string') setNotes(bl.notes)
    const next: Record<number, string> = {}
    for (const l of bl.lignes ?? []) {
      next[l.id] = String(l.quantite_livree)
    }
    setLigneQty(next)
  }, [bl?.id])

  const mutUpdate = useMutation({
    mutationFn: () => {
      const lignes = (bl?.lignes ?? [])
        .map((l) => {
          const raw = ligneQty[l.id]
          const n = raw === undefined || raw === '' ? Number(l.quantite_livree) : Number(raw)
          return { id: l.id, quantite_livree: Number.isFinite(n) ? n : 0 }
        })
        .filter((r) => r.id > 0)
      return bonsLivraisonApi.update(blId, { notes: notes || undefined, lignes })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bon-livraison', blId] })
    },
  })
  const mutValider = useMutation({
    mutationFn: () => bonsLivraisonApi.valider(blId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bon-livraison', blId] })
    },
  })

  if (!Number.isFinite(blId) || blId <= 0) {
    return <p className="error">Identifiant invalide.</p>
  }
  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de livraison', to: '/bons-livraison' },
          { label: '…' },
        ]}
        moduleBarLabel="Commercial"
        title="Chargement…"
      >
        <p className="text-muted">Chargement…</p>
      </ModuleEntityShell>
    )
  }
  if (error || !bl) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de livraison', to: '/bons-livraison' },
          { label: 'Erreur' },
        ]}
        moduleBarLabel="Commercial"
        title="Introuvable"
      >
        <p className="error">{(error as Error)?.message ?? 'Accès refusé.'}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Bons de livraison', to: '/bons-livraison' },
        { label: bl.numero },
      ]}
      moduleBarLabel="Commercial"
      title={`Bon de livraison ${bl.numero}`}
      subtitle={
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span className="dossier-badge dossier-badge--cours">{bl.statut}</span>
          <Link to={`/dossiers/${bl.dossier_id}/bc-bl`} className="link-inline">
            Dossier #{bl.dossier_id}
          </Link>
          {bl.bon_commande_id && (
            <Link to={`/bons-commande/${bl.bon_commande_id}`} className="link-inline">
              BC #{bl.bon_commande_id}
            </Link>
          )}
        </span>
      }
    >
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Nomenclature BLC — quantités livrées sur les lignes.
      </p>

      <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
        <table className="data-table data-table--compact">
          <tbody>
            <tr>
              <th>Date livraison</th>
              <td>{String(bl.date_livraison).slice(0, 10)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="h2" style={{ fontSize: '1.05rem' }}>
        Lignes
      </h2>
      {!(bl.lignes?.length ?? 0) && <p className="text-muted">Aucune ligne.</p>}
      {!!bl.lignes?.length && (
        <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Qté livrée</th>
              </tr>
            </thead>
            <tbody>
              {bl.lignes.map((l) => (
                <tr key={l.id}>
                  <td>{l.libelle}</td>
                  <td>
                    {lab ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={ligneQty[l.id] ?? String(l.quantite_livree)}
                        onChange={(e) => setLigneQty((m) => ({ ...m, [l.id]: e.target.value }))}
                        style={{ maxWidth: 120 }}
                      />
                    ) : (
                      l.quantite_livree
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lab && (
        <section className="card" style={{ maxWidth: 520 }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Notes et validation
          </h2>
          <label>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ width: '100%', marginTop: '0.25rem' }}
            />
          </label>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => mutUpdate.mutate()}
              disabled={mutUpdate.isPending}
            >
              Enregistrer
            </button>
            {bl.statut !== 'signe' && bl.statut !== 'livre' && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (window.confirm('Valider ce bon de livraison ?')) mutValider.mutate()
                }}
                disabled={mutValider.isPending}
              >
                Valider
              </button>
            )}
          </div>
        </section>
      )}
    </ModuleEntityShell>
  )
}
