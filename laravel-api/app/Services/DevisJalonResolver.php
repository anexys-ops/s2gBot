<?php

namespace App\Services;

use App\Models\BonCommande;

/**
 * Résout l'appartenance d'une ligne de BC à un jalon du devis (regroupement par
 * product_ref_article_ids dans quote.meta.devis_jalons), en miroir de
 * react-frontend/src/lib/bcLigneDisplay.ts (buildBcLigneDisplayRows) côté frontend.
 */
class DevisJalonResolver
{
    /**
     * IDs d'articles (ref_article_id) partageant le même jalon devis que $refArticleId,
     * lui-même inclus. Retourne [$refArticleId] si aucune structure de jalon ne le contient
     * (ligne autonome, ou BC sans devis structuré).
     *
     * @return list<int>
     */
    public function siblingRefArticleIds(BonCommande $bc, int $refArticleId): array
    {
        $jalons = $bc->quote?->meta['devis_jalons'] ?? [];
        foreach ($jalons as $jalon) {
            $refs = array_map('intval', $jalon['product_ref_article_ids'] ?? []);
            if (in_array($refArticleId, $refs, true)) {
                return array_values(array_unique($refs));
            }
        }

        return [$refArticleId];
    }
}
