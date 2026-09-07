/** Colonnes identifiants lisibles (références dossier, chantier, commande…). */
export const DATA_TABLE_REFERENCE_CLASS = 'data-table__reference'

/** Colonnes numéros / codes courts (devis, BC, factures, catalogue…). */
export const DATA_TABLE_CODE_CLASS = 'data-table__code'

export function dataTableColClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
