<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;

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

    /**
     * Tous les jalons du devis auxquels une ligne de BC est rattachée. Un même produit
     * (ex. « Déplacement du technicien pour contrôle ») peut figurer dans plusieurs
     * jalons : on les retourne tous plutôt que de n'en retenir qu'un arbitrairement.
     *
     * @return list<array{id: string, label: string, code: string|null}>
     */
    public function jalonsForLigne(?BonCommande $bc, ?BonCommandeLigne $ligne): array
    {
        $jalons = $bc?->quote?->meta['devis_jalons'] ?? [];
        if (! $ligne || $jalons === []) {
            return [];
        }

        $matches = [];
        foreach ($jalons as $jalon) {
            $label = trim((string) ($jalon['libelle'] ?? ''));
            $refs = array_map('intval', $jalon['product_ref_article_ids'] ?? []);
            $matchesProduct = $ligne->ref_article_id && in_array((int) $ligne->ref_article_id, $refs, true);
            $matchesForfait = $label !== '' && $ligne->libelle === 'Prestation forfaitaire — '.$label;
            if (! $matchesProduct && ! $matchesForfait) {
                continue;
            }
            $matches[] = [
                'id' => (string) ($jalon['id'] ?? ''),
                'label' => $label,
                'code' => $jalon['s2g_code'] ?? null,
            ];
        }

        return $matches;
    }

    /** Libellé lisible « CODE — Libellé / CODE2 — Libellé2 » (vide si aucun jalon). */
    public function jalonsLabel(?BonCommande $bc, ?BonCommandeLigne $ligne): string
    {
        return implode(' / ', array_map(
            fn (array $j) => trim(($j['code'] ? $j['code'].' — ' : '').$j['label']),
            $this->jalonsForLigne($bc, $ligne),
        ));
    }
}
