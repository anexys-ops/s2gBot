import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordresMissionApi, planningTerrainApi, type OrdreMission } from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import PlanningMassActionsBar from '../../components/planning/PlanningMassActionsBar'
import ErrorAlert from '../../components/errors/ErrorAlert'
import { toggleAllSelection } from '../../lib/planningMassApply'
import { formatTechnicienOption } from '../../lib/userRolePresentation'
import { dateInputFromApi, toLocalDateInput } from '../../lib/appLocale'

function toYmd(d: Date): string {
  return toLocalDateInput(d)
}

function addDays(d: Date, n: number): string {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return toYmd(x)
}

export type OrdreMissionPlanningKind = 'labo' | 'ingenieur'

type FlatLigne = {
  key: string
  omId: number
  omNumero: string
  ligneId: number
  libelle: string
  clientName: string
  assignedUserId: number | null
  datePrevue: string
  statut: string
}

type Props = {
  kind: OrdreMissionPlanningKind
  hubTo: string
  hubLabel: string
  moduleBarLabel: string
  title: string
  subtitle: string
  assigneeLabel: string
  emptyMessage: string
}

function flattenOrdres(ordres: OrdreMission[]): FlatLigne[] {
  const rows: FlatLigne[] = []
  for (const om of ordres) {
    for (const ligne of om.lignes ?? []) {
      rows.push({
        key: `${om.id}-${ligne.id}`,
        omId: om.id,
        omNumero: om.numero,
        ligneId: ligne.id,
        libelle: ligne.libelle,
        clientName: om.client?.name ?? '—',
        assignedUserId: ligne.assigned_user_id ?? null,
        datePrevue: dateInputFromApi(ligne.date_prevue),
        statut: ligne.statut,
      })
    }
  }
  return rows
}

export default function OrdreMissionPlanningEditorPage({
  kind,
  hubTo,
  hubLabel,
  moduleBarLabel,
  title,
  subtitle,
  assigneeLabel,
  emptyMessage,
}: Props) {
  const qc = useQueryClient()
  const [from, setFrom] = useState(() => toYmd(new Date()))
  const [to, setTo] = useState(() => addDays(new Date(), 30))
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [draftAssignee, setDraftAssignee] = useState<number | ''>('')
  const [draftDate, setDraftDate] = useState('')
  const [edits, setEdits] = useState<Record<string, { assigned_user_id: number | null; date_prevue: string }>>({})

  const { data: ordres = [], isLoading, error } = useQuery({
    queryKey: ['ordres-mission', 'planning', kind, from, to],
    queryFn: () => ordresMissionApi.planning({ type: kind, from, to }),
  })

  const { data: assignees = [] } = useQuery({
    queryKey: ['planning-terrain', 'techniciens', kind],
    queryFn: () => planningTerrainApi.techniciens(kind),
  })

  const baseRows = useMemo(() => flattenOrdres(ordres), [ordres])

  const rows = useMemo(
    () =>
      baseRows.map((row) => {
        const edit = edits[row.key]
        return {
          ...row,
          assignedUserId: edit?.assigned_user_id ?? row.assignedUserId,
          datePrevue: edit?.date_prevue ?? row.datePrevue,
        }
      }),
    [baseRows, edits],
  )

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedKeys.has(r.key)),
    [rows, selectedKeys],
  )

  const saveMut = useMutation({
    mutationFn: async (targets: FlatLigne[]) => {
      for (const row of targets) {
        const edit = edits[row.key]
        if (!edit) continue
        await ordresMissionApi.updateLigne(row.omId, row.ligneId, {
          assigned_user_id: edit.assigned_user_id,
          date_prevue: edit.date_prevue || null,
        })
      }
    },
    onSuccess: () => {
      setEdits({})
      setSelectedKeys(new Set())
      void qc.invalidateQueries({ queryKey: ['ordres-mission', 'planning', kind] })
      void qc.invalidateQueries({ queryKey: ['ordres-mission', kind] })
    },
  })

  const dirtyKeys = useMemo(() => Object.keys(edits), [edits])

  function applyMassToSelection() {
    const targets = selectedKeys.size > 0 ? selectedRows : rows
    if (targets.length === 0) return
    const hasAssignee = draftAssignee !== ''
    const hasDate = Boolean(draftDate)
    if (!hasAssignee && !hasDate) return

    setEdits((prev) => {
      const next = { ...prev }
      for (const row of targets) {
        next[row.key] = {
          assigned_user_id: hasAssignee ? draftAssignee : (prev[row.key]?.assigned_user_id ?? row.assignedUserId),
          date_prevue: hasDate ? draftDate : (prev[row.key]?.date_prevue ?? row.datePrevue),
        }
      }
      return next
    })
  }

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: hubLabel, to: hubTo },
        { label: 'Planning' },
      ]}
      moduleBarLabel={moduleBarLabel}
      title={title}
      subtitle={subtitle}
    >
      <div className="planning-page-filters">
        <label>
          Du
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          au
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {error ? <ErrorAlert error={error} fallback="Impossible de charger le planning." /> : null}
      {isLoading ? <p className="text-muted">Chargement…</p> : null}

      {!isLoading && rows.length > 0 ? (
        <>
          <PlanningMassActionsBar
            assignees={assignees}
            assigneeId={draftAssignee}
            onAssigneeChange={setDraftAssignee}
            assigneeLabel={assigneeLabel}
            dateDebut={draftDate}
            onDateDebutChange={setDraftDate}
            showDateFin={false}
            dateDebutLabel="Date prévue"
            onApply={applyMassToSelection}
            applyLabel="Appliquer aux lignes"
            selectedCount={selectedKeys.size > 0 ? selectedKeys.size : rows.length}
            totalCount={rows.length}
            hint="Sélectionnez des lignes ou laissez tout coché pour appliquer à l’ensemble visible."
          />

          <div className="planning-mass-actions__save-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saveMut.isPending || dirtyKeys.length === 0}
              onClick={() => saveMut.mutate(rows.filter((r) => edits[r.key]))}
            >
              {saveMut.isPending ? 'Enregistrement…' : `Enregistrer (${dirtyKeys.length})`}
            </button>
          </div>

          {saveMut.isError ? (
            <ErrorAlert error={saveMut.error} fallback="Échec de l’enregistrement." />
          ) : null}

          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={rows.length > 0 && selectedKeys.size === rows.length}
                      onChange={(e) => setSelectedKeys(toggleAllSelection(selectedKeys, rows.map((r) => r.key), e.target.checked))}
                    />
                  </th>
                  <th>OdM</th>
                  <th>Ligne</th>
                  <th>Client</th>
                  <th>{assigneeLabel}</th>
                  <th>Date prévue</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const dirty = Boolean(edits[row.key])
                  return (
                    <tr key={row.key} className={dirty ? 'planning-row--dirty' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.key)}
                          onChange={(e) => {
                            setSelectedKeys((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(row.key)
                              else next.delete(row.key)
                              return next
                            })
                          }}
                        />
                      </td>
                      <td>
                        <Link to={`/ordres-mission/${row.omId}`} className="link-inline">
                          {row.omNumero}
                        </Link>
                      </td>
                      <td>{row.libelle}</td>
                      <td>{row.clientName}</td>
                      <td>
                        <select
                          value={row.assignedUserId ?? ''}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [row.key]: {
                                assigned_user_id: e.target.value ? Number(e.target.value) : null,
                                date_prevue: prev[row.key]?.date_prevue ?? row.datePrevue,
                              },
                            }))
                          }
                        >
                          <option value="">—</option>
                          {assignees.map((u) => (
                            <option key={u.id} value={u.id}>
                              {formatTechnicienOption(u)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          value={row.datePrevue}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [row.key]: {
                                assigned_user_id: prev[row.key]?.assigned_user_id ?? row.assignedUserId,
                                date_prevue: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td>{row.statut}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!isLoading && !error && rows.length === 0 ? <p className="text-muted">{emptyMessage}</p> : null}
    </ModuleEntityShell>
  )
}
