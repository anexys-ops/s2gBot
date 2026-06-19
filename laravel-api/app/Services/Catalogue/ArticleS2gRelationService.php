<?php

namespace App\Services\Catalogue;

use App\Models\Catalogue\Article;
use App\Models\JalonProduct;
use App\Models\QualificationTag;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ArticleS2gRelationService
{
    /**
     * @param  list<int>  $qualificationTagIds
     * @param  list<int>  $productArticleIds
     */
    public function syncJalon(Article $jalon, array $qualificationTagIds, array $productArticleIds): void
    {
        if (! $jalon->isJalon()) {
            return;
        }

        $this->assertIdsAreKind($qualificationTagIds, QualificationTag::class, 'qualification_tag_ids');
        $this->assertArticleIdsAreKind($productArticleIds, Article::KIND_PRODUCT, 'product_article_ids');

        $jalon->qualificationTags()->sync($qualificationTagIds);

        JalonProduct::query()->where('jalon_article_id', $jalon->id)->delete();

        $ordre = 1;
        foreach ($productArticleIds as $productId) {
            JalonProduct::query()->create([
                'jalon_article_id' => $jalon->id,
                'product_article_id' => $productId,
                'ordre' => $ordre++,
            ]);
        }
    }

    /**
     * @param  list<int>  $jalonArticleIds
     */
    public function syncProductJalons(Article $product, array $jalonArticleIds): void
    {
        if (! $product->isProduct()) {
            return;
        }

        $this->assertArticleIdsAreKind($jalonArticleIds, Article::KIND_JALON, 'jalon_article_ids');

        JalonProduct::query()->where('product_article_id', $product->id)->delete();

        foreach ($jalonArticleIds as $jalonId) {
            $nextOrdre = (int) JalonProduct::query()
                ->where('jalon_article_id', $jalonId)
                ->max('ordre') + 1;

            JalonProduct::query()->create([
                'jalon_article_id' => $jalonId,
                'product_article_id' => $product->id,
                'ordre' => max(1, $nextOrdre),
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{article: Article, qualification_tag_ids: list<int>, product_article_ids: list<int>, jalon_article_ids: list<int>}
     */
    public function createArticleWithRelations(array $data): Article
    {
        $qualificationTagIds = array_values(array_map('intval', $data['qualification_tag_ids'] ?? []));
        $productArticleIds = array_values(array_map('intval', $data['product_article_ids'] ?? []));
        $jalonArticleIds = array_values(array_map('intval', $data['jalon_article_ids'] ?? []));

        unset($data['qualification_tag_ids'], $data['product_article_ids'], $data['jalon_article_ids']);

        return DB::transaction(function () use ($data, $qualificationTagIds, $productArticleIds, $jalonArticleIds) {
            $article = Article::query()->create($data);

            if ($article->isJalon()) {
                $this->syncJalon($article, $qualificationTagIds, $productArticleIds);
            }

            if ($article->isProduct()) {
                $this->syncProductJalons($article, $jalonArticleIds);
            }

            return $article->fresh();
        });
    }

    /**
     * @param  list<int>  $ids
     */
    private function assertArticleIdsAreKind(array $ids, string $kind, string $field): void
    {
        if ($ids === []) {
            return;
        }

        $count = Article::query()->whereIn('id', $ids)->where('kind', $kind)->count();
        if ($count !== count($ids)) {
            throw ValidationException::withMessages([
                $field => ["Tous les identifiants doivent référencer des articles de type « {$kind} »."],
            ]);
        }
    }

    /**
     * @param  class-string  $modelClass
     * @param  list<int>  $ids
     */
    private function assertIdsAreKind(array $ids, string $modelClass, string $field): void
    {
        if ($ids === []) {
            return;
        }

        $count = $modelClass::query()->whereIn('id', $ids)->count();
        if ($count !== count($ids)) {
            throw ValidationException::withMessages([
                $field => ['Une ou plusieurs références sont invalides.'],
            ]);
        }
    }
}
