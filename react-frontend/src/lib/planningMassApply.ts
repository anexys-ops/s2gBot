/** Applique technicien / dates à un ensemble d’identifiants de lignes. */
export function applyMassToLineIds<T extends string | number>(
  lineIds: T[],
  opts: {
    assigneeId?: number | ''
    dateDebut?: string
    dateFin?: string
    setAssignee?: (id: T, userId: number) => void
    setDateDebut?: (id: T, value: string) => void
    setDateFin?: (id: T, value: string) => void
  },
): number {
  let count = 0
  for (const lineId of lineIds) {
    let touched = false
    if (opts.assigneeId !== undefined && opts.assigneeId !== '' && opts.setAssignee) {
      opts.setAssignee(lineId, opts.assigneeId)
      touched = true
    }
    if (opts.dateDebut && opts.setDateDebut) {
      opts.setDateDebut(lineId, opts.dateDebut)
      touched = true
    }
    if (opts.dateFin && opts.setDateFin) {
      opts.setDateFin(lineId, opts.dateFin)
      touched = true
    }
    if (touched) count += 1
  }
  return count
}

export function toggleAllSelection<T>(_current: Set<T>, all: T[], checked: boolean): Set<T> {
  return checked ? new Set(all) : new Set()
}
