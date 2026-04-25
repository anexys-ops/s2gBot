import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, type BonCommandeLigne } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import ExtrafieldsForm from '../../components/module/ExtrafieldsForm'
import ClientContactPicker from '../../components/clients/ClientContactPicker'

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

export default function BonCommandeFichePage() {
  const { id } = useParams<{ id: string }>()
  const bcId = Number(id)
  const { user } = useAuth()
  const qc = useQueryClient()
  const lab = isLab(user?.role)
  const [notes, setNotes] = useState('')
  const [contactId, setContactId] = useState<number | null>(null)
  const [ligneEdits, setLigneEdits] = useState<Record<number, { debut: string; fin: string }>>({})

  const { data: bc, isLoading, error } = useQuery({
    queryKey: ['bon-commande', bcId],
    queryFn: () => bonsCommandeApi.get(bcId),
    enabled: Number.isFinite(bcId) && bcId > 0,
  })

  useEffect(() => {
    if (!bc) return
    setNotes(typeof bc.notes === 'string' ? bc.notes : '')
    setContactId(bc.contact_id ?? null)
  }, [bc?.id])

  useEffect(() => {
    if (!bc?.lignes?.length) {
      setLigneEdits({})
      return
    }
    const next: Record<number, { debut: string; fin: string }> = {}
    for (const l of bc.lignes) {
      const dl = l as BonCommandeLigne
      next[l.id] = {
        debut: dl.date_debut_prevue ? String(dl.date_debut_prevue).slice(0, 10) : '',
        fin: dl.date_fin_prevue ? String(dl.date_fin_prevue).slice(0, 10) : '',
      }
    }
    setLigneEdits(next)
  }, [bc?.id, bc?.lignes])

  const mutUpdate = useMutation({
    mutationFn: () => bonsCommandeApi.update(bcId, { notes: notes || undefined, contact_id: contactId }),
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
  const mutLignesPeriodes = useMutation({
    mutationFn: async () => {
      if (!bc?.lignes?.length) return
      for (const l of bc.lignes) {
        const e = ligneEdits[l.id]
        if (!e) continue
        const prevD = l.date_debut_prevue ? String(l.date_debut_prevue).slice(0, 10) : ''
        const prevF = l.date_fin_prevue ? String(l.date_fin_prevue).slice(0, 10) : ''
        if (e.debut === prevD && e.fin === prevF) continue
        await bonsCommandeApi.updateLigne(bcId, l.id, {
          date_debut_prevue: e.debut || null,
          date_fin_prevue: e.fin || null,
        })
      }
    },
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
            <tr>
              <th>Contact client</th>
              <td>
                {bc.clientContact
                  ? `${bc.clientContact.prenom} ${bc.clientContact.nom}${bc.clientContact.poste ? ` — ${bc.clientContact.poste}` : ‘’}`
                  : ‘—‘}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {lab && (
        <div className="card" style={{ marginBottom: ‘1.25rem’ }}>
          <ClientContactPicker
            clientId={bc.client_id}
            value={contactId}
            onChange={(id) => setContactId(id)}
            label="Contact commercial (BC)"
            contactType="commercial"
          />
          <div style={{ marginTop: ‘0.5rem’ }}>
            <button className="btn btn-secondary btn-sm" onClick={() => mutUpdate.mutate()} disabled={mutUpdate.isPending}>
              Enregistrer le contact
            </button>
          </div>
        </div>
      )}

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
                {lab && (
                  <>
                    <th>Début terrain (prévu)</th>
                    <th>Fin terrain (prévu)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {bc.lignes.map((l) => (
                <tr key={l.id}>
                  <td>{l.libelle}</td>
                  <td>{l.quantite}</td>
                  <td>{l.prix_unitaire_ht}</td>
                  <td>{l.montant_ht}</td>
                  {lab && (
                    <>
                      <td>
                        <input
                          type="date"
                          value={ligneEdits[l.id]?.debut ?? ''}
                          onChange={(e) =>
                            setLigneEdits((s) => ({
                              ...s,
                              [l.id]: { ...s[l.id], debut: e.target.value, fin: s[l.id]?.fin ?? '' },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={ligneEdits[l.id]?.fin ?? ''}
                          onChange={(e) =>
                            setLigneEdits((s) => ({
                              ...s,
                              [l.id]: { debut: s[l.id]?.debut ?? '', fin: e.target.value },
                            }))
                          }
                        />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lab && !!bc.lignes?.length && (
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => mutLignesPeriodes.mutate()}
            disabled={mutLignesPeriodes.isPending}
          >
            Enregistrer les périodes terrain (lignes)
          </button>
          {mutLignesPeriodes.isError && (
            <p className="error" style={{ marginTop: '0.5rem' }}>
              {(mutLignesPeriodes.error as Error)?.message}
            </p>
          )}
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
      {lab && <ExtrafieldsForm entityType="bon_commande" entityId={bc.id} canEdit title="Champs personnalisés BC" />}
    </ModuleEntityShell>
  )
}
