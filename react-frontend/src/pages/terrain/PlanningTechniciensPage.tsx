import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bonsCommandeApi,
  planningTerrainApi,
  type BonCommande,
  type BonCommandeLigne,
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

/** Lundi 00:00 (local) de la semaine contenant `d`. */
function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, day] = ymd.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, day ?? 1)
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weekDaysFrom(ymdFrom: string): Date[] {
  const start = startOfWeekMonday(parseYmdLocal(ymdFrom))
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function affectationOnDay(
  a: { date_debut: string; date_fin: string },
  day: Date
): boolean {
  const t = ymdLocal(day)
  const ds = String(a.date_debut).slice(0, 10)
  const de = String(a.date_fin).slice(0, 10)
  return t >= ds && t <= de
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
  const [unposBcFilter, setUnposBcFilter] = useState<number | ''>('')
  const [unposUserIdMap, setUnposUserIdMap] = useState<Record<number, number | ''>>({})
  const [unposDebugMap, setUnposDebugMap] = useState<Record<number, string>>({})
  const [unposFinMap, setUnposFinMap] = useState<Record<number, string>>({})
  const [unposNotesMap, setUnposNotesMap] = useState<Record<number, string>>({})

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

  const affectatedLigneIds = useMemo(
    () => new Set((affectations ?? []).map((a) => a.bon_commande_ligne_id)),
    [affectations]
  )

  const unpositionedLignes = useMemo(() => {
    const all: (BonCommandeLigne & { bc_id: number; bc_numero: string; dossier_id: number })[] = []
    for (const bc of bcs) {
      if (unposBcFilter !== '' && bc.id !== unposBcFilter) continue
      for (const ligne of bc.lignes ?? []) {
        if (!affectatedLigneIds.has(ligne.id)) {
          all.push({
            ...ligne,
            bc_id: bc.id,
            bc_numero: bc.numero,
            dossier_id: bc.dossier_id,
          })
        }
      }
    }
    return all
  }, [bcs, affectatedLigneIds, unposBcFilter])

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

  const createUnposMut = useMutation({
    mutationFn: (ligneId: number) =>
      planningTerrainApi.create({
        bon_commande_ligne_id: ligneId,
        user_id: unposUserIdMap[ligneId] as number,
        date_debut: unposDebugMap[ligneId] || toYmd(new Date()),
        date_fin: unposFinMap[ligneId] || toYmd(new Date()),
        notes: unposNotesMap[ligneId] || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning-terrain'] })
      void qc.invalidateQueries({ queryKey: ['bons-commande'] })
      setUnposUserIdMap({})
      setUnposDebugMap({})
      setUnposFinMap({})
      setUnposNotesMap({})
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
      subtitle="Affectations rattachées aux lignes des bons de commande — vue semaine (grille) + tableau, création depuis les BC."
    >
      {lab && bonsListe && (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
            Lignes non affectées
          </h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Lignes de BC sans affectation terrain. Assignez un technicien et des dates pour créer l'affectation.
          </p>
          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Filtrer par BC
              <select
                value={unposBcFilter === '' ? '' : String(unposBcFilter)}
                onChange={(e) => setUnposBcFilter(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">Tous</option>
                {bcs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.numero} (dossier #{b.dossier_id})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {unpositionedLignes.length === 0 && (
            <p className="text-muted">Aucune ligne non affectée.</p>
          )}
          {unpositionedLignes.length > 0 && (
            <div className="table-wrap">
              <table className="data-table data-table--compact" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>BC</th>
                    <th>Ligne</th>
                    <th>Technicien</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unpositionedLignes.map((ligne) => (
                    <tr key={ligne.id}>
                      <td>
                        <Link to={`/bons-commande/${ligne.bc_id}`} className="link-inline">
                          {ligne.bc_numero}
                        </Link>
                      </td>
                      <td>{ligne.libelle}</td>
                      <td>
                        <select
                          value={unposUserIdMap[ligne.id] === undefined ? '' : String(unposUserIdMap[ligne.id])}
                          onChange={(e) =>
                            setUnposUserIdMap((m) => ({
                              ...m,
                              [ligne.id]: e.target.value === '' ? '' : Number(e.target.value),
                            }))
                          }
                          style={{ width: '100%' }}
                        >
                          <option value="">—</option>
                          {techniciens?.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          )) ?? null}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          value={unposDebugMap[ligne.id] || toYmd(new Date())}
                          onChange={(e) =>
                            setUnposDebugMap((m) => ({
                              ...m,
                              [ligne.id]: e.target.value,
                            }))
                          }
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={unposFinMap[ligne.id] || toYmd(new Date())}
                          onChange={(e) =>
                            setUnposFinMap((m) => ({
                              ...m,
                              [ligne.id]: e.target.value,
                            }))
                          }
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={unposNotesMap[ligne.id] || ''}
                          onChange={(e) =>
                            setUnposNotesMap((m) => ({
                              ...m,
                              [ligne.id]: e.target.value,
                            }))
                          }
                          style={{ width: '100%' }}
                          placeholder="Notes"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button--secondary"
                          disabled={
                            createUnposMut.isPending ||
                            unposUserIdMap[ligne.id] === '' ||
                            unposUserIdMap[ligne.id] === undefined
                          }
                          onClick={() => createUnposMut.mutate(ligne.id)}
                        >
                          Créer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {createUnposMut.isError && (
            <p className="error" style={{ marginTop: '0.75rem' }}>
              {(createUnposMut.error as Error).message}
            </p>
          )}
        </section>
      )}

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

      {!isLoading && affectations !== undefined && (
        <>
          <section style={{ marginBottom: '1.5rem' }} aria-label="Aperçu semaine calendrier">
            <h2 className="h2" style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>
              Aperçu semaine
            </h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Semaine contenant la date « Du » ({from}) — lundi → dimanche. Même filtre période / technicien que le
              tableau.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 6,
              }}
            >
              {weekDaysFrom(from).map((day) => {
                const label = day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                const dayA = affectations.filter((a) => affectationOnDay(a, day))
                return (
                  <div
                    key={ymdLocal(day)}
                    className="card"
                    style={{ padding: '0.5rem', fontSize: '0.8rem', minWidth: 0 }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 6,
                        borderBottom: '1px solid var(--color-border, #ddd)',
                        paddingBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    {dayA.length === 0 && <span className="text-muted">—</span>}
                    {dayA.map((a) => {
                      const bc = a.bon_commande_ligne?.bon_commande
                      return (
                        <div key={a.id} style={{ marginBottom: 6, lineHeight: 1.3 }}>
                          {a.user?.name?.split(' ')[0] ?? `U${a.user_id}`}
                          {bc && (
                            <>
                              {' '}
                              <Link to={`/bons-commande/${bc.id}`} className="link-inline">
                                {bc.numero}
                              </Link>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </section>
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
        </>
      )}

      {lab && techniciens && bonsListe && (
        <section className="card" style={{ maxWidth: 640 }}>
          <h2 className="h2" style={{ fontSize: '1.05rem' }}>
            Nouvelle affectation
          </h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Choisissez un bon de commande, une ligne de produit, puis le technicien et les dates d'intervention. Les
            dates d'affectation doivent rester dans la période prévue sur la ligne (défini sur la fiche BC).
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
                Créer l'affectation
              </button>
            </div>
            {createMut.isError && <p className="error">{(createMut.error as Error).message}</p>}
          </div>
        </section>
      )}

      <p className="text-muted" style={{ marginTop: '1.5rem' }}>
        Navigation <Link to="/terrain">Chantier</Link> — les périodes par produit se saisissent sur la fiche d'un{' '}
        <Link to="/bons-commande">bon de commande</Link> (lignes).
      </p>
    </ModuleEntityShell>
  )
}
