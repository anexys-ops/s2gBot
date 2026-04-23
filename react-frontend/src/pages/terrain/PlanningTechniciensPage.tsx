import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bonsCommandeApi,
  planningTerrainApi,
  type BonCommande,
} from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'

function toYmd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

export default function PlanningTechniciensPage() {
  const { user } = useAuth()
  const lab = isLab(user?.role)
  const qc = useQueryClient()
  const [from, setFrom] = useState(() => toYmd(new Date()))
  const [to, setTo] = useState(() => toYmd(addDays(new Date(), 21)))
  const [userFilter, setUserFilter] = useState<number | ''>('')
  const [newUserId, setNewUserId] = useState<number | ''>('')
  const [newBcId, setNewBcId] = useState<number | ''>('')
  const [newLigneId, setNewLigneId] = useState<number | ''>('')
  const [newDebut, setNewDebut] = useState(() => toYmd(new Date()))
  const [newFin, setNewFin] = useState(() => toYmd(new Date()))
  const [newNotes, setNewNotes] = useState('')

  const { data: affectations, isLoading, error } = useQuery({
    queryKey: ['planning-terrain', from, to, userFilter],
    queryFn: () =>
      planningTerrainApi.list({
        from,
        to,
        user_id: userFilter === '' ? undefined : userFilter,
      }),
  })

  const { data: techniciens } = useQuery({
    queryKey: ['planning-terrain', 'techniciens'],
    queryFn: () => planningTerrainApi.techniciens(),
    enabled: lab === true,
  })

  const { data: bonsListe } = useQuery({
    queryKey: ['bons-commande', 'all-planning'],
    queryFn: () => bonsCommandeApi.list(),
  })

  const bcs: BonCommande[] = bonsListe ?? []
  const selectedBc = useMemo(
    () => bcs.find((b) => b.id === newBcId) ?? null,
    [bcs, newBcId]
  )

  const createMut = useMutation({
    mutationFn: () =>
      planningTerrainApi.create({
        bon_commande_ligne_id: newLigneId as number,
        user_id: newUserId as number,
        date_debut: newDebut,
        date_fin: newFin,
        notes: newNotes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning-terrain'] })
      setNewNotes('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => planningTerrainApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning-terrain'] })
    },
  })

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Chantier', to: '/terrain' },
        { label: 'Planning' },
      ]}
      moduleBarLabel="Chantier"
      title="Planning techniciens"
      subtitle="Affectations rattachées aux lignes des bons de commande (période prévue + créneau technicien)."
    >
      <div
        className="table-wrap"
        style={{ marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}
      >
        <label>
          Du
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>
        <label>
          au
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>
        <label>
          Technicien
          <select
            value={userFilter === '' ? '' : String(userFilter)}
            onChange={(e) => setUserFilter(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ display: 'block', marginTop: 4, minWidth: 200 }}
          >
            <option value="">Tous</option>
            {lab
              ? (techniciens ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              : null}
          </select>
        </label>
      </div>
      {lab && techniciens && techniciens.length === 0 && userFilter === '' && (
        <p className="text-muted" style={{ marginBottom: '0.75rem' }}>
          Aucun utilisateur lab trouvé pour le filtre.
        </p>
      )}

      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}

      {!isLoading && affectations && (
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Période</th>
                <th>Technicien</th>
                <th>BC / ligne</th>
                <th>Client / dossier</th>
                {lab && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {affectations.length === 0 && (
                <tr>
                  <td colSpan={lab ? 5 : 4} className="text-muted">
                    Aucune affectation sur cette période.
                  </td>
                </tr>
              )}
              {affectations.map((a) => {
                const ligne = a.bon_commande_ligne
                const bc = ligne?.bon_commande
                return (
                  <tr key={a.id}>
                    <td>
                      {String(a.date_debut).slice(0, 10)} → {String(a.date_fin).slice(0, 10)}
                    </td>
                    <td>{a.user?.name ?? `Utilisateur #${a.user_id}`}</td>
                    <td>
                      {bc && (
                        <>
                          <Link to={`/bons-commande/${bc.id}`} className="link-inline">
                            {bc.numero}
                          </Link>
                          {ligne ? ` — ${ligne.libelle}` : ''}
                        </>
                      )}
                      {!bc && '—'}
                    </td>
                    <td>
                      {bc && (
                        <>
                          {bc.client?.name ?? '—'} /{' '}
                          <Link to={`/dossiers/${bc.dossier_id}/bc-bl`} className="link-inline">
                            Dossier #{bc.dossier_id}
                          </Link>
                        </>
                      )}
                    </td>
                    {lab && (
                      <td>
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => {
                            if (window.confirm("Supprimer cette affectation du planning ?")) {
                              deleteMut.mutate(a.id)
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {lab && techniciens && bonsListe && (
        <section className="card" style={{ maxWidth: 640 }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Nouvelle affectation
          </h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Choisissez un bon de commande, une ligne de produit, puis le technicien et les dates d’intervention. Les
            dates d’affectation doivent rester dans la période prévue sur la ligne (défini sur la fiche BC).
          </p>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
            <label>
              Technicien
              <select
                value={newUserId === '' ? '' : String(newUserId)}
                onChange={(e) => setNewUserId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">—</option>
                {techniciens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bon de commande
              <select
                value={newBcId === '' ? '' : String(newBcId)}
                onChange={(e) => {
                  setNewBcId(e.target.value === '' ? '' : Number(e.target.value))
                  setNewLigneId('')
                }}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">—</option>
                {bcs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.numero} (dossier #{b.dossier_id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ligne BC
              <select
                value={newLigneId === '' ? '' : String(newLigneId)}
                onChange={(e) => setNewLigneId(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!selectedBc}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">—</option>
                {selectedBc?.lignes?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.libelle}
                  </option>
                )) ?? null}
              </select>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <label>
                Du
                <input
                  type="date"
                  value={newDebut}
                  onChange={(e) => setNewDebut(e.target.value)}
                  style={{ display: 'block', marginTop: 4 }}
                />
              </label>
              <label>
                au
                <input
                  type="date"
                  value={newFin}
                  onChange={(e) => setNewFin(e.target.value)}
                  style={{ display: 'block', marginTop: 4 }}
                />
              </label>
            </div>
            <label>
              Notes
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <div>
              <button
                type="button"
                className="button"
                disabled={
                  createMut.isPending ||
                  newUserId === '' ||
                  newLigneId === '' ||
                  newDebut > newFin
                }
                onClick={() => createMut.mutate()}
              >
                Créer l’affectation
              </button>
            </div>
            {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
          </div>
        </section>
      )}

      <p className="text-muted" style={{ marginTop: '1.5rem' }}>
        Navigation <Link to="/terrain">Chantier</Link> — les périodes par produit se saisissent sur la fiche d’un{' '}
        <Link to="/bons-commande">bon de commande</Link> (lignes).
      </p>
    </ModuleEntityShell>
  )
}
