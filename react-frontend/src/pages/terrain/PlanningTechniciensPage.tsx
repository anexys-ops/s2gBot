import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, planningTerrainApi, type BonCommande } from '../../api/client'
import StatusBadge, { bonCommandeStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import { useAuth } from '../../contexts/AuthContext'
import { dateInputFromApi, toLocalDateInput } from '../../lib/appLocale'
import { formatTechnicienOption } from '../../lib/userRolePresentation'
import TerrainPlanningPdfModal from '../../components/pdf/TerrainPlanningPdfModal'

type PeriodMode = 'jour' | 'semaine' | 'periode'

function toYmd(date: Date) {
  return toLocalDateInput(date)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeekMonday(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7))
  return next
}

function parseYmdLocal(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function ymdLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function weekDaysFrom(value: string): Date[] {
  const start = startOfWeekMonday(parseYmdLocal(value))
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function affectationOnDay(affectation: { date_debut: string; date_fin: string }, day: Date): boolean {
  const target = ymdLocal(day)
  return target >= dateInputFromApi(affectation.date_debut) && target <= dateInputFromApi(affectation.date_fin)
}

function formatBcPlanningOption(bc: BonCommande): string {
  const statut = bonCommandeStatutBadgeProps(bc.statut).label
  const client = bc.client?.name ? ` — ${bc.client.name}` : ''
  return `${bc.numero} (${statut})${client}`
}

const isLab = (role?: string) => role === 'lab_admin' || role === 'lab_technician'

export default function PlanningTechniciensPage() {
  const { user } = useAuth()
  const lab = isLab(user?.role)
  const qc = useQueryClient()
  const initialWeekStart = startOfWeekMonday(new Date())
  const [from, setFrom] = useState(() => toYmd(initialWeekStart))
  const [to, setTo] = useState(() => toYmd(addDays(initialWeekStart, 6)))
  const [periodMode, setPeriodMode] = useState<PeriodMode>('semaine')
  const [userFilter, setUserFilter] = useState<number | ''>('')
  const [unposBcFilter, setUnposBcFilter] = useState<number | ''>('')
  const [unposUserIdMap, setUnposUserIdMap] = useState<Record<number, number | ''>>({})
  const [unposDebutMap, setUnposDebutMap] = useState<Record<number, string>>({})
  const [unposFinMap, setUnposFinMap] = useState<Record<number, string>>({})
  const [unposNotesMap, setUnposNotesMap] = useState<Record<number, string>>({})
  const [pdfOpen, setPdfOpen] = useState(false)

  const { data: affectations, isLoading, error } = useQuery({
    queryKey: ['planning-terrain', from, to, userFilter],
    queryFn: () => planningTerrainApi.list({
      from,
      to,
      user_id: userFilter === '' ? undefined : userFilter,
    }),
  })

  const { data: techniciens } = useQuery({
    queryKey: ['planning-terrain', 'techniciens'],
    queryFn: () => planningTerrainApi.techniciens(),
    enabled: lab,
  })

  const { data: unassignedBcs } = useQuery({
    queryKey: ['bons-commande', 'planning', 'unassigned'],
    queryFn: () => bonsCommandeApi.list({ planning: true, unassignedPlanning: true }),
    enabled: lab,
  })

  const selectedBc = useMemo(
    () => (unassignedBcs ?? []).find((bc) => bc.id === unposBcFilter) ?? null,
    [unassignedBcs, unposBcFilter],
  )

  const unpositionedLignes = useMemo(() => {
    if (!selectedBc) return []
    return (selectedBc.lignes ?? []).map((ligne) => ({
      ...ligne,
      bc_id: selectedBc.id,
      bc_numero: selectedBc.numero,
      bc_statut: selectedBc.statut,
    }))
  }, [selectedBc])

  const unpositionedGroups = useMemo(() => {
    if (!selectedBc) return []
    if (selectedBc.planning_terrain_groups?.length) {
      return selectedBc.planning_terrain_groups.map((group) => ({
        ...group,
        lignes: group.lignes.map((ligne) => ({
          ...ligne,
          bc_id: selectedBc.id,
          bc_numero: selectedBc.numero,
          bc_statut: selectedBc.statut,
        })),
      }))
    }
    return unpositionedLignes.length > 0
      ? [{ jalon: { id: 'standalone', label: 'Tâches terrain hors jalon' }, lignes: unpositionedLignes }]
      : []
  }, [selectedBc, unpositionedLignes])

  const createUnposMut = useMutation({
    mutationFn: (ligneId: number) => planningTerrainApi.create({
      bon_commande_ligne_id: ligneId,
      user_id: unposUserIdMap[ligneId] as number,
      date_debut: unposDebutMap[ligneId] || toYmd(new Date()),
      date_fin: unposFinMap[ligneId] || unposDebutMap[ligneId] || toYmd(new Date()),
      notes: unposNotesMap[ligneId] || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning-terrain'] })
      void qc.invalidateQueries({ queryKey: ['bons-commande', 'planning', 'unassigned'] })
      setUnposBcFilter('')
      setUnposUserIdMap({})
      setUnposDebutMap({})
      setUnposFinMap({})
      setUnposNotesMap({})
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => planningTerrainApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning-terrain'] })
      void qc.invalidateQueries({ queryKey: ['bons-commande', 'planning', 'unassigned'] })
    },
  })

  const selectedTechnician = (techniciens ?? []).find((item) => item.id === userFilter)
  const printTechnicianLabel = selectedTechnician ? formatTechnicienOption(selectedTechnician) : 'Tous les techniciens'
  const printPeriodLabel = from === to ? from : `${from} au ${to}`

  function selectDay() {
    setPeriodMode('jour')
    setTo(from)
  }

  function selectWeek() {
    const start = startOfWeekMonday(parseYmdLocal(from))
    setPeriodMode('semaine')
    setFrom(toYmd(start))
    setTo(toYmd(addDays(start, 6)))
  }

  function changeFrom(value: string) {
    if (periodMode === 'semaine') {
      const start = startOfWeekMonday(parseYmdLocal(value))
      setFrom(toYmd(start))
      setTo(toYmd(addDays(start, 6)))
      return
    }
    setFrom(value)
    if (periodMode === 'jour' || value > to) setTo(value)
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm terrain-planning"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Chantier', to: '/terrain' },
        { label: 'Planning' },
      ]}
      moduleBarLabel="Chantier"
      title="Planning techniciens"
      subtitle="Planning et aperçu hebdomadaire filtrables par période et par technicien."
    >
      {lab ? (
        <section className="card terrain-planning__unassigned" style={{ marginBottom: '1.5rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Bons de commande non affectés</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Choisissez un BC pour afficher uniquement ses tâches terrain encore sans affectation, classées par jalon.
          </p>
          <label>
            BC non affecté
            <select
              value={unposBcFilter}
              onChange={(event) => setUnposBcFilter(event.target.value ? Number(event.target.value) : '')}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            >
              <option value="">— Choisir un BC —</option>
              {(unassignedBcs ?? []).map((bc) => (
                <option key={bc.id} value={bc.id}>{formatBcPlanningOption(bc)}</option>
              ))}
            </select>
          </label>

          {unposBcFilter === '' ? (
            <p className="text-muted" style={{ margin: '0.75rem 0 0' }}>
              Les tâches terrain s’afficheront après la sélection d’un BC.
            </p>
          ) : null}
          {unposBcFilter !== '' && unpositionedLignes.length === 0 ? (
            <p className="text-muted" style={{ margin: '0.75rem 0 0' }}>Toutes les tâches terrain de ce BC sont affectées.</p>
          ) : null}

          {unpositionedLignes.length > 0 ? (
            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="data-table data-table--compact" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>BC</th><th>Statut</th><th>Tâche terrain</th><th>Technicien</th><th>Début</th><th>Fin</th><th>Notes</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unpositionedGroups.map((group) => (
                    <Fragment key={group.jalon.id}>
                      <tr className="terrain-planning__jalon-row">
                        <td colSpan={8}>
                          {group.jalon.code ? <strong>{group.jalon.code} — </strong> : null}
                          <strong>{group.jalon.label}</strong>
                        </td>
                      </tr>
                      {group.lignes.map((ligne) => (
                        <tr key={ligne.id}>
                          <td><Link to={`/bons-commande/${ligne.bc_id}`} className="link-inline">{ligne.bc_numero}</Link></td>
                          <td><StatusBadge {...bonCommandeStatutBadgeProps(ligne.bc_statut)} /></td>
                          <td>{ligne.libelle}</td>
                          <td>
                            <select
                              value={unposUserIdMap[ligne.id] ?? ''}
                              onChange={(event) => setUnposUserIdMap((current) => ({
                                ...current,
                                [ligne.id]: event.target.value ? Number(event.target.value) : '',
                              }))}
                            >
                              <option value="">—</option>
                              {(techniciens ?? []).map((item) => (
                                <option key={item.id} value={item.id}>{formatTechnicienOption(item)}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="date"
                              value={unposDebutMap[ligne.id] || toYmd(new Date())}
                              onChange={(event) => {
                                const value = event.target.value
                                setUnposDebutMap((current) => ({ ...current, [ligne.id]: value }))
                                setUnposFinMap((current) => ({ ...current, [ligne.id]: value }))
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={unposFinMap[ligne.id] || unposDebutMap[ligne.id] || toYmd(new Date())}
                              onChange={(event) => setUnposFinMap((current) => ({ ...current, [ligne.id]: event.target.value }))}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={unposNotesMap[ligne.id] || ''}
                              onChange={(event) => setUnposNotesMap((current) => ({ ...current, [ligne.id]: event.target.value }))}
                              placeholder="Notes"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={createUnposMut.isPending || !unposUserIdMap[ligne.id]}
                              onClick={() => createUnposMut.mutate(ligne.id)}
                            >
                              {createUnposMut.isPending && createUnposMut.variables === ligne.id ? 'Création…' : 'Créer'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {createUnposMut.isError ? <p className="error">{(createUnposMut.error as Error).message}</p> : null}
        </section>
      ) : null}

      <div className="terrain-planning__print-title">
        <h1>Planning techniciens</h1>
        <p>{printTechnicianLabel} — {printPeriodLabel}</p>
      </div>

      <section className="card terrain-planning__filters no-print" style={{ marginBottom: '1.25rem' }}>
        <div className="terrain-planning__period-modes">
          <button type="button" className={`btn btn-sm ${periodMode === 'jour' ? 'btn-primary' : 'btn-secondary'}`} onClick={selectDay}>Jour</button>
          <button type="button" className={`btn btn-sm ${periodMode === 'semaine' ? 'btn-primary' : 'btn-secondary'}`} onClick={selectWeek}>Semaine</button>
          <button type="button" className={`btn btn-sm ${periodMode === 'periode' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriodMode('periode')}>Période</button>
        </div>
        <div className="terrain-planning__filter-row">
          <label>Du<input type="date" value={from} onChange={(event) => changeFrom(event.target.value)} /></label>
          <label>
            Au
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => {
                setPeriodMode('periode')
                setTo(event.target.value)
              }}
              disabled={periodMode !== 'periode'}
            />
          </label>
          <label>
            Technicien
            <select value={userFilter} onChange={(event) => setUserFilter(event.target.value ? Number(event.target.value) : '')}>
              <option value="">Tous les techniciens</option>
              {(techniciens ?? []).map((item) => (
                <option key={item.id} value={item.id}>{formatTechnicienOption(item)}</option>
              ))}
            </select>
          </label>
          {lab ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPdfOpen(true)}>
              Générer le PDF
            </button>
          ) : null}
        </div>
      </section>

      {isLoading ? <p className="text-muted">Chargement…</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}

      {!isLoading && affectations ? (
        <div className="terrain-planning__print-area">
          <section style={{ marginBottom: '1.5rem' }} aria-label="Aperçu semaine calendrier">
            <h2 className="h2" style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Aperçu semaine</h2>
            <p className="text-muted no-print" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Semaine contenant la date de début, avec le même filtre technicien que le tableau.
            </p>
            <div className="terrain-planning__week-grid">
              {weekDaysFrom(from).map((day) => {
                const dayAffectations = affectations.filter((item) => affectationOnDay(item, day))
                return (
                  <div key={ymdLocal(day)} className="card terrain-planning__day-card">
                    <div className="terrain-planning__day-title">
                      {day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    {dayAffectations.length === 0 ? <span className="text-muted">—</span> : null}
                    {dayAffectations.map((item) => {
                      const bc = item.bon_commande_ligne?.bon_commande
                      return (
                        <div key={item.id} className="terrain-planning__day-event">
                          <strong>{item.user?.name ?? `Utilisateur #${item.user_id}`}</strong>
                          {bc ? <Link to={`/bons-commande/${bc.id}`} className="link-inline">{bc.numero}</Link> : null}
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
                  <th>Période</th><th>Technicien</th><th>BC / ligne</th><th>Client / dossier</th>
                  {lab ? <th className="terrain-planning__actions">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {affectations.length === 0 ? (
                  <tr><td colSpan={lab ? 5 : 4} className="text-muted">Aucune affectation sur cette période.</td></tr>
                ) : null}
                {affectations.map((item) => {
                  const ligne = item.bon_commande_ligne
                  const bc = ligne?.bon_commande
                  return (
                    <tr key={item.id}>
                      <td>{dateInputFromApi(item.date_debut)} → {dateInputFromApi(item.date_fin)}</td>
                      <td>{item.user?.name ?? `Utilisateur #${item.user_id}`}</td>
                      <td>
                        {bc ? <><Link to={`/bons-commande/${bc.id}`} className="link-inline">{bc.numero}</Link>{ligne ? ` — ${ligne.libelle}` : ''}</> : '—'}
                      </td>
                      <td>
                        {bc ? <>{bc.client?.name ?? '—'} / <Link to={`/dossiers/${bc.dossier_id}/bc-bl`} className="link-inline">Dossier #{bc.dossier_id}</Link></> : '—'}
                      </td>
                      {lab ? (
                        <td className="terrain-planning__actions">
                          <button
                            type="button"
                            className="button button--secondary"
                            onClick={() => {
                              if (window.confirm('Supprimer cette affectation du planning ?')) deleteMut.mutate(item.id)
                            }}
                          >Supprimer</button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-muted no-print" style={{ marginTop: '1.5rem' }}>
        Navigation <Link to="/terrain">Chantier</Link> — les périodes par produit se saisissent sur la fiche d’un <Link to="/bons-commande">bon de commande</Link>.
      </p>
      {pdfOpen ? (
        <TerrainPlanningPdfModal
          from={from}
          to={to}
          userId={userFilter === '' ? undefined : userFilter}
          technicianLabel={printTechnicianLabel}
          onClose={() => setPdfOpen(false)}
        />
      ) : null}
    </ModuleEntityShell>
  )
}
