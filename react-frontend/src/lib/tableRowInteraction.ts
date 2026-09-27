/** Ignore les clics sur liens, boutons ou zones d’actions pour la navigation au clic sur la ligne. */
export function shouldIgnoreTableRowClick(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('a, button, .data-table__actions, .data-table__action-cell, .data-table__pdf'))
}
