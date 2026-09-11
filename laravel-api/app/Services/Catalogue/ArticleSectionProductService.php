<?php

namespace App\Services\Catalogue;

use App\Models\ArticleSectionProduct;
use App\Models\Catalogue\Article;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ArticleSectionProductService
{
    /**
     * @return array{
     *   technicien: list<array<string, mixed>>,
     *   ingenieur: list<array<string, mixed>>,
     *   labo: list<array<string, mixed>>
     * }
     */
    public function groupedForArticle(Article $article): array
    {
        $rows = $article->sectionProducts()
            ->with(['productArticle:id,code,libelle,unite,prix_unitaire_ht,kind,actif'])
            ->orderBy('section_type')
            ->orderBy('ordre')
            ->get();

        $grouped = [
            ArticleSectionProduct::SECTION_TECHNICIEN => [],
            ArticleSectionProduct::SECTION_INGENIEUR => [],
            ArticleSectionProduct::SECTION_LABO => [],
        ];

        foreach ($rows as $row) {
            $product = $row->productArticle;
            $grouped[$row->section_type][] = [
                'id' => $row->id,
                'ordre' => $row->ordre,
                'product_article_id' => $row->product_article_id,
                'product' => $product ? [
                    'id' => $product->id,
                    'code' => $product->code,
                    'libelle' => $product->libelle,
                    'unite' => $product->unite,
                    'prix_unitaire_ht' => $product->prix_unitaire_ht,
                    'kind' => $product->kind,
                    'actif' => $product->actif,
                ] : null,
            ];
        }

        return $grouped;
    }

    /**
     * @param  list<int>  $productArticleIds
     * @return array{
     *   technicien: list<array<string, mixed>>,
     *   ingenieur: list<array<string, mixed>>,
     *   labo: list<array<string, mixed>>
     * }
     */
    public function syncSection(Article $article, string $sectionType, array $productArticleIds): array
    {
        if (! in_array($sectionType, ArticleSectionProduct::SECTIONS, true)) {
            throw ValidationException::withMessages([
                'section_type' => ['Section invalide.'],
            ]);
        }

        if (! $article->isJalon() && ! $article->isProduct()) {
            throw ValidationException::withMessages([
                'ref_article_id' => ['Seuls les articles S2G (jalon ou produit) supportent cette affectation.'],
            ]);
        }

        $productArticleIds = array_values(array_unique(array_map('intval', $productArticleIds)));
        $this->assertValidProductIds($article, $productArticleIds);

        return DB::transaction(function () use ($article, $sectionType, $productArticleIds) {
            if ($productArticleIds !== []) {
                ArticleSectionProduct::query()
                    ->where('ref_article_id', $article->id)
                    ->whereIn('product_article_id', $productArticleIds)
                    ->where('section_type', '!=', $sectionType)
                    ->delete();
            }

            if ($article->isProduct() && $productArticleIds !== []) {
                ArticleSectionProduct::query()
                    ->where('ref_article_id', $article->id)
                    ->delete();
            }

            ArticleSectionProduct::query()
                ->where('ref_article_id', $article->id)
                ->where('section_type', $sectionType)
                ->delete();

            $ordre = 1;
            foreach ($productArticleIds as $productId) {
                ArticleSectionProduct::query()->create([
                    'ref_article_id' => $article->id,
                    'product_article_id' => $productId,
                    'section_type' => $sectionType,
                    'ordre' => $ordre++,
                ]);
            }

            return $this->groupedForArticle($article->fresh());
        });
    }

    /**
     * @param  list<int>  $productArticleIds
     */
    private function assertValidProductIds(Article $article, array $productArticleIds): void
    {
        if ($productArticleIds === []) {
            return;
        }

        if ($article->isProduct()) {
            if ($productArticleIds !== [$article->id]) {
                throw ValidationException::withMessages([
                    'product_article_ids' => ['Un produit S2G ne peut être assigné qu’à lui-même.'],
                ]);
            }

            return;
        }

        $allowed = $article->jalonProductLinks()->pluck('product_article_id')->all();
        $invalid = array_diff($productArticleIds, $allowed);
        if ($invalid !== []) {
            throw ValidationException::withMessages([
                'product_article_ids' => ['Un ou plusieurs produits ne sont pas rattachés à ce jalon.'],
            ]);
        }

        $count = Article::query()
            ->whereIn('id', $productArticleIds)
            ->where('kind', Article::KIND_PRODUCT)
            ->count();

        if ($count !== count($productArticleIds)) {
            throw ValidationException::withMessages([
                'product_article_ids' => ['Tous les identifiants doivent référencer des produits S2G.'],
            ]);
        }
    }
}
