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
     * lui-même inclus.
     * - Si le BC n'a AUCUNE structure de jalons (devis absent, non structuré, ou BC créé
     *   sans devis) : retourne null — impossible de distinguer des jalons, donc pas de
     *   restriction possible (l'appelant doit alors élargir à tout le BC plutôt que de
     *   se limiter à tort au seul article de départ, ce qui exclurait quasi toujours les
     *   FOLD terrain, dont l'article diffère de celui de la tâche labo).
     * - Si des jalons existent mais qu'aucun ne contient $refArticleId (ligne autonome
     *   dans un devis structuré) : retourne [$refArticleId] — la restriction est ici
     *   volontaire et significative.
     *
     * @return list<int>|null
     */
    public function siblingRefArticleIds(BonCommande $bc, int $refArticleId): ?array
    {
        $jalons = $bc->quote?->meta['devis_jalons'] ?? [];
        if ($jalons === []) {
            return null;
        }

        foreach ($jalons as $jalon) {
            $refs = array_map('intval', $jalon['product_ref_article_ids'] ?? []);
            if (in_array($refArticleId, $refs, true)) {
                return array_values(array_unique($refs));
            }
        }

        return [$refArticleId];
    }
}
