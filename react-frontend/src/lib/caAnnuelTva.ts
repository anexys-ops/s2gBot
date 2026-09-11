/** Régime TVA « CA de l'année » : 25 % récupérable, 75 % reversée à l'État. */
export const CA_ANNUEL_TVA_RECUPERABLE_RATIO = 0.25
export const CA_ANNUEL_TVA_ETAT_RATIO = 0.75

export type CaAnnuelTvaSplit = {
  tva_nominale: number
  tva_recuperable: number
  tva_etat: number
  amount_tva: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function applyCaAnnuelTvaRegime(nominalTva: number): CaAnnuelTvaSplit {
  const tvaNominale = round2(Math.max(0, nominalTva))
  const tvaRecuperable = round2(tvaNominale * CA_ANNUEL_TVA_RECUPERABLE_RATIO)
  const tvaEtat = round2(tvaNominale * CA_ANNUEL_TVA_ETAT_RATIO)

  return {
    tva_nominale: tvaNominale,
    tva_recuperable: tvaRecuperable,
    tva_etat: tvaEtat,
    amount_tva: tvaEtat,
  }
}

export function ttcFromHtWithCaRegime(ht: number, nominalTvaRate: number, caAnnuelTvaRegime: boolean): number {
  const safeHt = Math.max(0, ht)
  const rate = Math.min(100, Math.max(0, nominalTvaRate))
  const nominalTva = round2(safeHt * (rate / 100))
  if (!caAnnuelTvaRegime) {
    return round2(safeHt + nominalTva)
  }
  return round2(safeHt + applyCaAnnuelTvaRegime(nominalTva).amount_tva)
}
