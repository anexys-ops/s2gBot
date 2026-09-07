import { formatTechnicienOption, type TechnicienOption } from '../../lib/userRolePresentation'

export type PlanningMassActionsBarProps = {
  assignees?: TechnicienOption[]
  assigneeId: number | ''
  onAssigneeChange: (id: number | '') => void
  showAssignee?: boolean
  assigneeLabel?: string
  dateDebut: string
  onDateDebutChange: (value: string) => void
  dateFin?: string
  onDateFinChange?: (value: string) => void
  showDateFin?: boolean
  dateDebutLabel?: string
  dateFinLabel?: string
  onApply: () => void
  applyLabel?: string
  disabled?: boolean
  selectedCount?: number
  totalCount?: number
  hint?: string
}

export default function PlanningMassActionsBar({
  assignees = [],
  assigneeId,
  onAssigneeChange,
  showAssignee = true,
  assigneeLabel = 'Assigner à',
  dateDebut,
  onDateDebutChange,
  dateFin = '',
  onDateFinChange,
  showDateFin = true,
  dateDebutLabel = 'Date début',
  dateFinLabel = 'Date fin',
  onApply,
  applyLabel = 'Appliquer en masse',
  disabled = false,
  selectedCount,
  totalCount,
  hint,
}: PlanningMassActionsBarProps) {
  const scopeLabel =
    selectedCount !== undefined && totalCount !== undefined
      ? selectedCount === totalCount
        ? ` (${totalCount} ligne${totalCount > 1 ? 's' : ''})`
        : ` (${selectedCount}/${totalCount})`
      : ''

  return (
    <div className="planning-mass-actions">
      <div className="planning-mass-actions__head">
        <strong className="planning-mass-actions__title">Actions de masse{scopeLabel}</strong>
        {hint ? <p className="planning-mass-actions__hint text-muted">{hint}</p> : null}
      </div>
      <div className="planning-mass-actions__fields">
        {showAssignee ? (
          <label className="planning-mass-actions__field">
            <span>{assigneeLabel}</span>
            <select
              value={assigneeId === '' ? '' : String(assigneeId)}
              onChange={(e) => onAssigneeChange(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— Ne pas modifier —</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatTechnicienOption(u)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="planning-mass-actions__field">
          <span>{dateDebutLabel}</span>
          <input type="date" value={dateDebut} onChange={(e) => onDateDebutChange(e.target.value)} />
        </label>
        {showDateFin && onDateFinChange ? (
          <label className="planning-mass-actions__field">
            <span>{dateFinLabel}</span>
            <input type="date" value={dateFin} onChange={(e) => onDateFinChange(e.target.value)} />
          </label>
        ) : null}
        <button type="button" className="btn btn-secondary btn-sm planning-mass-actions__apply" disabled={disabled} onClick={onApply}>
          {applyLabel}
        </button>
      </div>
    </div>
  )
}
