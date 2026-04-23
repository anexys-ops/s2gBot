import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

export default function BonCommandeFichePage() {
  const { id } = useParams<{ id: string }>()
  const bcId = Number(id)
  const { user } = useAuth()
  const qc = useQueryClient()
  const lab = isLab(user?.role)
  const [notes, setNotes] = useState('')

  const { data: bc, isLoading, error } = useQuery({
    queryKey: ['bon-commande', bcId],
    queryFn: () => bonsCommandeApi.get(bcId),
    enabled: Number.isFinite(bcId) && bcId > 0,
  })

  useEffect(() => {
    if (!bc) return
    setNotes(typeof bc.notes === 'string' ? bc.notes : '')
  }, [bc?.id])

  const mutUpdate = useMutation({
    mutationFn: () => bonsCommandeApi.update(bcId, { notes: notes || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
    },
  })
  const mutConfirmer = useMutation({
    mutationFn: () => bonsCommandeApi.confirmer(bcId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
    },
  })
  const mutBl = useMutation({
    mutationFn: () => bonsCommandeApi.transformerBl(bcId),
    onSuccess: (bl) => {
      void qc.invalidateQueries({ queryKey: ['bon-commande', bcId] })
      if (bl?.id) {
        window.location.assign(`/bons-livraison/${bl.id}`)
      }
    },
  })

  if (!Number.isFinite(bcId) || bcId <= 0) {
    return <p className="error">Identifiant invalide.</p>
  }
  if (isLoading) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de commande', to: '/bons-commande' },
          { label: '…' },
        ]}
        moduleBarLabel="Commercial"
        title="Chargement…"
      >
        <p className="text-muted">Chargement…</p>
      </ModuleEntityShell>
    )
  }
  if (error || !bc) {
    return (
      <ModuleEntityShell
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Bons de commande', to: '/bons-commande' },
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
        { label: 'Bons de commande', to: '/bons-commande' },
        { label: bc.numero },
      ]}
      moduleBarLabel="Commercial"
      title={`Bon de commande ${bc.numero}`}
      subtitle={
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span className="dossier-badge dossier-badge--cours">{bc.statut}</span>
          <Link to={`/dossiers/${bc.dossier_id}/bc-bl`} className="link-inline">
            Dossier #{bc.dossier_id}
          </Link>
        </span>
      }
    >
      <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
        <table className="data-table data-table--compact">
          <tbody>
            <tr>
              <th>Date commande</th>
              <td>{String(bc.date_commande).slice(0, 10)}</td>
            </tr>
            <tr>
              <th>Date livraison prévue</th>
              <td>{bc.date_livraison_prevue ? String(bc.date_livraison_prevue).slice(0, 10) : '—'}</td>
            </tr>
            <tr>
              <th>Montants</th>
              <td>
                HT {bc.montant_ht} — TTC {bc.montant_ttc} (TVA {bc.tva_rate})
              </td>
            </tr>
            {bc.quote_id && (
              <tr>
                <th>Devis d’origine</th>
                <td>
                  <Link to={`/devis/${bc.quote_id}/editer`} className="link-inline">
                    Devis #{bc.quote_id}
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="h2" style={{ fontSize: '1.05rem' }}>
        Lignes
      </h2>
      {!(bc.lignes?.length ?? 0) && <p className="text-muted">Aucune ligne.</p>}
      {!!bc.lignes?.length && (
        <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Qté</th>
                <th>PU HT</th>
                <th>Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {bc.lignes.map((l) => (
                <tr key={l.id}>
                  <td>{l.libelle}</td>
                  <td>{l.quantite}</td>
                  <td>{l.prix_unitaire_ht}</td>
                  <td>{l.montant_ht}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lab && (
        <section className="card" style={{ maxWidth: 520 }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Notes et actions lab
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
              Enregistrer les notes
            </button>
            {bc.statut === 'brouillon' && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (window.confirm('Confirmer ce bon de commande ?')) mutConfirmer.mutate()
                }}
                disabled={mutConfirmer.isPending}
              >
                Confirmer
              </button>
            )}
            {(bc.statut === 'confirme' || bc.statut === 'en_cours' || bc.statut === 'livre') && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (window.confirm('Générer un bon de livraison (BLC) à partir de ce BC ?')) mutBl.mutate()
                }}
                disabled={mutBl.isPending}
              >
                Générer / lier un BL
              </button>
            )}
          </div>
          {mutBl.data?.id && (
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              BL créé :{' '}
              <Link to={`/bons-livraison/${mutBl.data.id}`} className="link-inline">
                {mutBl.data.numero}
              </Link>
            </p>
          )}
        </section>
      )}
    </ModuleEntityShell>
  )
}
