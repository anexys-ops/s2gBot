<?php

namespace App\Support;

use App\Models\Catalogue\Article;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Réactive l’ensemble du catalogue visible (articles, familles, multi-site).
 */
final class CatalogueVisibilityRestore
{
    /**
     * @return array{articles: int, familles: int, restored: int}
     */
    public static function run(): array
    {
        $articlesUpdated = 0;
        $famillesUpdated = 0;
        $restored = 0;

        if (! Schema::hasTable('ref_articles')) {
            return ['articles' => 0, 'familles' => 0, 'restored' => 0];
        }

        if (Schema::hasColumn('ref_articles', 'deleted_at')) {
            $restored = Article::withTrashed()
                ->whereIn('kind', [Article::KIND_JALON, Article::KIND_PRODUCT])
                ->whereNotNull('deleted_at')
                ->restore();
        }

        $articlesUpdated = DB::table('ref_articles')->update(['actif' => true]);

        if (Schema::hasColumn('ref_articles', 'is_multi_site')) {
            DB::table('ref_articles')->update(['is_multi_site' => true]);
        }

        if (Schema::hasTable('article_lab_agency')) {
            DB::table('article_lab_agency')->truncate();
        }

        if (Schema::hasTable('ref_famille_articles')) {
            DB::table('ref_famille_articles')->update(['actif' => true]);
            $famillesUpdated = (int) DB::table('ref_famille_articles')->where('actif', true)->count();
        }

        return [
            'articles' => $articlesUpdated,
            'familles' => $famillesUpdated,
            'restored' => $restored,
        ];
    }
}
