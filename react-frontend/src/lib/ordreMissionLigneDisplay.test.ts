import { describe, expect, it } from 'vitest'
import type { BonCommandeLigne, EntityMetaPayload, OrdreMissionLigne } from '../api/client'
import { buildOrdreMissionLigneGroups, ordreMissionLigneQuantite } from './ordreMissionLigneDisplay'

const meta: EntityMetaPayload = {
  devis_jalons: [
    { id: 'j-beton', libelle: 'Contrôle de béton', s2g_code: 'CB', product_ref_article_ids: [11, 12] },
    { id: 'j-sol', libelle: 'Contrôle de sol', s2g_code: 'CS', product_ref_article_ids: [21] },
  ],
  devis_parcours: [
    { kind: 'jalon', id: 'j-beton' },
    { kind: 'jalon', id: 'j-sol' },
  ],
}

function bcLine(id: number, ref: number, quantite: number): BonCommandeLigne {
  return { id, ref_article_id: ref, libelle: `BC ${id}`, ordre: id, quantite, prix_unitaire_ht: 0, tva_rate: 20, montant_ht: 0 }
}

function omLine(id: number, sourceId: number | null, ordre: number): OrdreMissionLigne {
  return {
    id,
    ordre_mission_id: 1,
    bon_commande_ligne_id: sourceId,
    libelle: `Tâche ${id}`,
    quantite: 1,
    statut: 'a_faire',
    ordre,
  }
}

describe('buildOrdreMissionLigneGroups', () => {
  it('affiche seulement les jalons contenant des tâches de cet ordre de mission', () => {
    const bcLignes = [bcLine(101, 11, 3), bcLine(102, 12, 3), bcLine(201, 21, 2)]
    const groups = buildOrdreMissionLigneGroups([omLine(1, 101, 0), omLine(2, 102, 1)], bcLignes, meta)

    expect(groups).toHaveLength(1)
    expect(groups[0].jalon?.label).toBe('Contrôle de béton')
    expect(groups[0].lignes.map((ligne) => ligne.id)).toEqual([1, 2])
  })

  it('conserve les tâches libres hors jalon', () => {
    const groups = buildOrdreMissionLigneGroups([omLine(9, null, 0)], [], meta)
    expect(groups).toEqual([{ key: 'standalone', jalon: null, lignes: [expect.objectContaining({ id: 9 })] }])
  })

  it('conserve la quantité modifiable de la ligne de mission', () => {
    const ligne = omLine(1, 101, 0)
    expect(ordreMissionLigneQuantite(ligne, new Map([[101, bcLine(101, 11, 7)]]))).toBe(1)
  })
})
