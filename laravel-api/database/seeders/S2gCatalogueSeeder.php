<?php

namespace Database\Seeders;

use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\JalonProduct;
use App\Models\QualificationTag;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Import catalogue S2G (tags → jalons → produits) depuis database/seeders/data/s2g_seed_data.json.
 *
 * ⚠️ Destructif : supprime TOUS les articles existants (hard delete) avant l’import.
 * Les lignes commerciales / OdM / échantillons conservent leurs enregistrements
 * mais perdent le lien catalogue (ref_article_id → null).
 *
 * Idempotent : relancer recrée le jeu S2G depuis zéro.
 */
class S2gCatalogueSeeder extends Seeder
{
    /** @var array<string, int> */
    private array $familleIdsByLabel = [];

    /** @var array<string, int> */
    private array $tagIdsByCode = [];

    /** @var array<string, int> */
    private array $articleIdsByCode = [];

    public function run(): void
    {
        $path = database_path('seeders/data/s2g_seed_data.json');
        if (! is_file($path)) {
            $this->command?->error("Fichier introuvable : {$path}");

            return;
        }

        $payload = json_decode((string) file_get_contents($path), true);
        if (! is_array($payload)) {
            $this->command?->error('seed_data.json invalide.');

            return;
        }

        $existingCount = Article::withTrashed()->count();
        $this->command?->warn(sprintf(
            'S2G catalogue : suppression de %d article(s), étiquettes PROLAB et qualification_tags existants, puis import.',
            $existingCount
        ));

        DB::transaction(function () use ($payload): void {
            $this->purgeExistingCatalogue();
            $this->seedTags($payload['tags'] ?? []);
            $this->seedArticles($payload['articles'] ?? []);
            $this->seedTagJalons($payload['tag_jalons'] ?? []);
            $this->seedJalonProducts($payload['jalon_products'] ?? []);
            $this->syncFamilleActivation();
        });

        $this->command?->info(sprintf(
            'S2G catalogue importé : %d tags, %d articles (%d jalons, %d produits).',
            QualificationTag::query()->count(),
            Article::query()->count(),
            Article::query()->where('kind', Article::KIND_JALON)->count(),
            Article::query()->where('kind', Article::KIND_PRODUCT)->count()
        ));
    }

    /**
     * Supprime tout le catalogue article existant avant import S2G.
     */
    private function purgeExistingCatalogue(): void
    {
        if (Schema::hasTable('qualification_tag_jalon')) {
            DB::table('qualification_tag_jalon')->delete();
        }

        if (Schema::hasTable('jalon_products')) {
            JalonProduct::query()->delete();
        }

        if (Schema::hasTable('qualification_tags')) {
            QualificationTag::query()->delete();
        }

        $this->purgeLegacyArticleTags();

        if (! Schema::hasTable('ref_articles')) {
            return;
        }

        // Liens article ↔ article (regroupement PROLAB) — éviter les contraintes circulaires.
        if (Schema::hasColumn('ref_articles', 'ref_article_lie_id')) {
            DB::table('ref_articles')->update(['ref_article_lie_id' => null]);
        }

        do {
            $batch = Article::withTrashed()
                ->orderBy('id')
                ->limit(250)
                ->get();

            foreach ($batch as $article) {
                $article->forceDelete();
            }
        } while ($batch->isNotEmpty());

        $remaining = Article::withTrashed()->count();
        if ($remaining > 0) {
            throw new \RuntimeException("Échec purge catalogue : {$remaining} article(s) encore présents.");
        }
    }

    /** Supprime les étiquettes PROLAB (JSON + pivot polymorphe) liées aux articles. */
    private function purgeLegacyArticleTags(): void
    {
        if (Schema::hasTable('taggables')) {
            DB::table('taggables')
                ->where(function ($q): void {
                    $q->where('taggable_type', Article::class)
                        ->orWhere('taggable_type', 'like', '%Catalogue\\\\Article%')
                        ->orWhere('taggable_type', 'like', '%ref_articles%');
                })
                ->delete();
        }

        if (Schema::hasTable('ref_articles') && Schema::hasColumn('ref_articles', 'tags')) {
            DB::table('ref_articles')->update(['tags' => null]);
        }
    }

    /** Désactive les familles PROLAB / géo sans article S2G actif. */
    private function syncFamilleActivation(): void
    {
        if (! Schema::hasTable('ref_famille_articles')) {
            return;
        }

        $activeFamilleIds = Article::query()
            ->whereIn('kind', [Article::KIND_JALON, Article::KIND_PRODUCT])
            ->distinct()
            ->pluck('ref_famille_article_id');

        FamilleArticle::query()->update(['actif' => false]);

        if ($activeFamilleIds->isNotEmpty()) {
            FamilleArticle::query()
                ->whereIn('id', $activeFamilleIds)
                ->update(['actif' => true]);
        }
    }

    /**
     * @param  list<array{code: string, label: string, groupe: string}>  $tags
     */
    private function seedTags(array $tags): void
    {
        foreach ($tags as $tag) {
            $model = QualificationTag::query()->create([
                'code' => $tag['code'],
                'label' => $tag['label'],
                'groupe' => $tag['groupe'],
            ]);
            $this->tagIdsByCode[$tag['code']] = (int) $model->id;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $articles
     */
    private function seedArticles(array $articles): void
    {
        foreach ($articles as $row) {
            $code = (string) ($row['code'] ?? '');
            if ($code === '') {
                continue;
            }

            $kind = (string) ($row['kind'] ?? Article::KIND_LEGACY);
            $familleLabel = trim((string) ($row['famille'] ?? ''));
            $tva = trim((string) ($row['tva'] ?? ''));

            $article = Article::query()->create([
                'ref_famille_article_id' => $this->resolveFamilleId($familleLabel, $kind),
                'code' => $code,
                'libelle' => (string) ($row['label'] ?? $code),
                'tags' => null,
                'unite' => (string) ($row['unite'] ?? 'U') ?: 'U',
                'prix_unitaire_ht' => 0,
                'tva_rate' => $this->parseTvaRate($tva),
                'duree_estimee' => 0,
                'actif' => true,
                'kind' => $kind,
                'famille_label' => $kind === Article::KIND_JALON && $familleLabel !== '' ? $familleLabel : null,
            ]);

            $this->articleIdsByCode[$code] = (int) $article->id;
        }
    }

    /**
     * @param  list<array{tag_code: string, jalon_code: string}>  $links
     */
    private function seedTagJalons(array $links): void
    {
        $rows = [];
        foreach ($links as $link) {
            $tagId = $this->tagIdsByCode[$link['tag_code']] ?? null;
            $jalonId = $this->articleIdsByCode[$link['jalon_code']] ?? null;
            if ($tagId === null || $jalonId === null) {
                continue;
            }
            $rows[] = [
                'qualification_tag_id' => $tagId,
                'jalon_article_id' => $jalonId,
            ];
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('qualification_tag_jalon')->insert($chunk);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $links
     */
    private function seedJalonProducts(array $links): void
    {
        foreach (array_chunk($links, 200) as $chunk) {
            $inserts = [];
            foreach ($chunk as $link) {
                $jalonId = $this->articleIdsByCode[$link['jalon_code']] ?? null;
                $productId = $this->articleIdsByCode[$link['product_code']] ?? null;
                if ($jalonId === null || $productId === null) {
                    continue;
                }
                $inserts[] = [
                    'jalon_article_id' => $jalonId,
                    'product_article_id' => $productId,
                    'ordre' => (int) ($link['ordre'] ?? 0),
                    'tache_code' => $link['tache_code'] ?? null,
                    'tache_label' => $link['tache_label'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            if ($inserts !== []) {
                JalonProduct::query()->insert($inserts);
            }
        }
    }

    private function resolveFamilleId(string $familleLabel, string $kind): int
    {
        if ($kind === Article::KIND_PRODUCT && $familleLabel === '') {
            $familleLabel = 'Produits S2G';
        }
        if ($familleLabel === '') {
            $familleLabel = 'Catalogue S2G';
        }

        if (isset($this->familleIdsByLabel[$familleLabel])) {
            return $this->familleIdsByLabel[$familleLabel];
        }

        $baseCode = 'S2G-'.Str::upper(Str::slug(Str::substr($familleLabel, 0, 48)));
        $code = $baseCode;
        $suffix = 1;
        while (
            FamilleArticle::query()->where('code', $code)->where('libelle', '!=', $familleLabel)->exists()
        ) {
            $code = $baseCode.'-'.$suffix;
            $suffix++;
        }

        $famille = FamilleArticle::query()->firstOrCreate(
            ['libelle' => $familleLabel],
            [
                'code' => $code,
                'ordre' => 900,
                'actif' => true,
            ]
        );

        $this->familleIdsByLabel[$familleLabel] = (int) $famille->id;

        return (int) $famille->id;
    }

    private function parseTvaRate(string $tva): float
    {
        if ($tva === '') {
            return 20.0;
        }

        return (float) str_replace(',', '.', $tva);
    }
}
