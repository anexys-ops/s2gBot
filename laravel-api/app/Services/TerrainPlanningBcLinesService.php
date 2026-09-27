<?php

namespace App\Services;

use App\Models\ArticleAction;
use App\Models\ArticleSectionProduct;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use Illuminate\Support\Collection;

final class TerrainPlanningBcLinesService
{
    public function contains(BonCommande $bonCommande, int $lineId): bool
    {
        $this->prepare($bonCommande);

        return $bonCommande->lignes->contains(fn (BonCommandeLigne $line) => (int) $line->id === $lineId);
    }

    /**
     * Conserve uniquement les lignes terrain réellement présentes sur le BC et
     * les restitue dans l'ordre des jalons du devis source.
     */
    public function prepare(BonCommande $bonCommande): bool
    {
        $bonCommande->loadMissing([
            'quote',
            'lignes.article.actions',
            'lignes.article.productJalonLinks.jalon.actions',
            'lignes.article.productJalonLinks.jalon.sectionProducts',
        ]);

        /** @var Collection<int, BonCommandeLigne> $lines */
        $lines = $bonCommande->lignes
            ->sort(function (BonCommandeLigne $a, BonCommandeLigne $b): int {
                $byOrder = ((int) ($a->ordre ?? 0)) <=> ((int) ($b->ordre ?? 0));

                return $byOrder !== 0 ? $byOrder : ((int) $a->id) <=> ((int) $b->id);
            })
            ->values();
        $meta = is_array($bonCommande->quote?->meta) ? $bonCommande->quote->meta : [];
        $jalons = $this->orderedJalons($meta);
        $usedLineIds = [];
        $jalonProductIds = [];
        $groups = [];

        foreach ($jalons as $jalon) {
            $productIds = collect($jalon['product_ref_article_ids'] ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values();
            if ($productIds->isEmpty()) {
                continue;
            }
            foreach ($productIds as $productId) {
                $jalonProductIds[$productId] = true;
            }

            $jalonArticleId = (int) ($jalon['ref_article_id'] ?? 0);
            $sectionRows = $jalonArticleId > 0
                ? ArticleSectionProduct::query()
                    ->where('ref_article_id', $jalonArticleId)
                    ->orderBy('ordre')
                    ->orderBy('id')
                    ->get(['product_article_id', 'section_type', 'ordre'])
                : collect();
            $structured = $sectionRows->isNotEmpty();
            $terrainProductIds = $structured
                ? $sectionRows
                    ->where('section_type', ArticleSectionProduct::SECTION_TECHNICIEN)
                    ->pluck('product_article_id')
                    ->map(fn ($id) => (int) $id)
                    ->all()
                : $productIds->all();

            $groupLines = collect();
            foreach ($productIds as $productId) {
                if (! in_array($productId, $terrainProductIds, true)) {
                    continue;
                }

                foreach ($lines as $line) {
                    if (isset($usedLineIds[$line->id]) || (int) $line->ref_article_id !== $productId) {
                        continue;
                    }
                    if (! $structured && ! $this->isTerrainLine($line)) {
                        continue;
                    }

                    $usedLineIds[$line->id] = true;
                    $groupLines->push($line);
                }
            }

            if ($groupLines->isNotEmpty()) {
                $groups[] = [
                    'jalon' => [
                        'id' => (string) ($jalon['id'] ?? ($jalonArticleId > 0 ? 'article-'.$jalonArticleId : 'jalon-'.count($groups))),
                        'code' => $jalon['s2g_code'] ?? null,
                        'label' => trim((string) ($jalon['libelle'] ?? '')) ?: 'Jalon',
                    ],
                    'lignes' => $groupLines->values(),
                ];
            }
        }

        $standalone = $lines->filter(function (BonCommandeLigne $line) use (&$usedLineIds, $jalons, $jalonProductIds): bool {
            if (isset($usedLineIds[$line->id])) {
                return false;
            }
            if ($line->ref_article_id) {
                if (isset($jalonProductIds[(int) $line->ref_article_id])) {
                    return false;
                }

                return $this->isTerrainLine($line);
            }

            // Compatibilité des anciens devis sans catalogue structuré. Les lignes
            // forfaitaires d'un devis à jalons ne sont jamais des tâches terrain.
            return $jalons === []
                && trim((string) $line->libelle) !== ''
                && ! str_starts_with((string) $line->libelle, 'Prestation forfaitaire');
        })->values();

        if ($standalone->isNotEmpty()) {
            $groups[] = [
                'jalon' => [
                    'id' => 'standalone',
                    'code' => null,
                    'label' => 'Tâches terrain hors jalon',
                ],
                'lignes' => $standalone,
            ];
        }

        $filteredLines = collect($groups)
            ->flatMap(fn (array $group) => $group['lignes'])
            ->values();
        $filteredLines->each(fn (BonCommandeLigne $line) => $line->unsetRelation('article'));
        $bonCommande->setRelation('lignes', $filteredLines);
        $bonCommande->setAttribute('planning_terrain_groups', $groups);

        return $filteredLines->isNotEmpty();
    }

    private function isTerrainLine(BonCommandeLigne $line): bool
    {
        $article = $line->article;
        if (! $article) {
            return false;
        }

        if ($this->articleIsTerrain($article)) {
            return true;
        }

        foreach ($article->productJalonLinks as $link) {
            $jalon = $link->jalon;
            if (! $jalon) {
                continue;
            }
            if ($jalon->sectionProducts->isNotEmpty()) {
                if ($jalon->sectionProducts->contains(
                    fn (ArticleSectionProduct $row) => (int) $row->product_article_id === (int) $article->id
                        && $row->section_type === ArticleSectionProduct::SECTION_TECHNICIEN
                )) {
                    return true;
                }

                continue;
            }
            if ($this->articleIsTerrain($jalon)) {
                return true;
            }
        }

        return false;
    }

    private function articleIsTerrain(Article $article): bool
    {
        return (bool) $article->triggers_odm_terrain
            || $article->actions->contains(
                fn (ArticleAction $action) => $action->type === ArticleAction::TYPE_TECHNICIEN
            );
    }

    /** @param array<string, mixed> $meta */
    private function orderedJalons(array $meta): array
    {
        $jalons = collect(is_array($meta['devis_jalons'] ?? null) ? $meta['devis_jalons'] : [])
            ->filter(fn ($jalon) => is_array($jalon))
            ->values();
        $byId = $jalons->keyBy(fn (array $jalon) => (string) ($jalon['id'] ?? ''));
        $ordered = collect();

        foreach (is_array($meta['devis_parcours'] ?? null) ? $meta['devis_parcours'] : [] as $item) {
            if (! is_array($item) || ($item['kind'] ?? null) !== 'jalon') {
                continue;
            }
            $id = (string) ($item['id'] ?? '');
            if ($byId->has($id)) {
                $ordered->push($byId->get($id));
                $byId->forget($id);
            }
        }

        return $ordered->concat($byId->values())->values()->all();
    }
}
