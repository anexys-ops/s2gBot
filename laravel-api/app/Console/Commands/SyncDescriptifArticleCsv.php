<?php

namespace App\Console\Commands;

use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\JalonProduct;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Import incrémental depuis un export « DescriptifArticle » (jalon → produit → tâche).
 * Ne recrée pas ce qui existe déjà (code article / lien jalon+produit+tâche).
 */
class SyncDescriptifArticleCsv extends Command
{
    protected $signature = 'catalogue:sync-descriptif-article
                            {path? : Chemin du CSV (défaut : seeders/data/descriptif_article_links.csv)}
                            {--dry-run : Analyser sans écrire}';

    protected $description = 'Ajoute jalons / produits / liens jalon_products manquants depuis un CSV DescriptifArticle (sans doublons)';

    public function handle(): int
    {
        $path = $this->argument('path') ?: database_path('seeders/data/descriptif_article_links.csv');
        if (! is_readable($path)) {
            $this->error("Fichier introuvable ou illisible : {$path}");

            return self::FAILURE;
        }

        $rows = $this->parseCsv($path);
        if ($rows === []) {
            $this->warn('Aucune ligne exploitable dans le CSV.');

            return self::SUCCESS;
        }

        $dry = (bool) $this->option('dry-run');
        $this->info(sprintf('CSV : %d ligne(s)%s', count($rows), $dry ? ' (dry-run)' : ''));

        $jalonFamilleId = $this->resolveFamilleId('Catalogue S2G');
        $productFamilleId = $this->resolveFamilleId('Produits S2G');

        $createdJalons = 0;
        $createdProducts = 0;
        $createdLinks = 0;
        $skippedLinks = 0;
        $restored = 0;
        $missingSkipped = 0;

        $articleCache = Article::withTrashed()
            ->whereIn('kind', [Article::KIND_JALON, Article::KIND_PRODUCT])
            ->get()
            ->keyBy(fn (Article $a) => $a->code);

        $run = function () use (
            $rows,
            $dry,
            $jalonFamilleId,
            $productFamilleId,
            &$articleCache,
            &$createdJalons,
            &$createdProducts,
            &$createdLinks,
            &$skippedLinks,
            &$restored,
            &$missingSkipped,
        ): void {
            foreach ($rows as $row) {
                $jalonCode = $row['jalon_code'];
                $productCode = $row['product_code'];
                if ($jalonCode === '' || $productCode === '') {
                    $missingSkipped++;

                    continue;
                }

                $jalon = $this->ensureArticle(
                    $articleCache,
                    $jalonCode,
                    $row['jalon_label'] !== '' ? $row['jalon_label'] : $jalonCode,
                    Article::KIND_JALON,
                    $jalonFamilleId,
                    $dry,
                    $createdJalons,
                    $restored,
                );
                $product = $this->ensureArticle(
                    $articleCache,
                    $productCode,
                    $row['product_label'] !== '' ? $row['product_label'] : $productCode,
                    Article::KIND_PRODUCT,
                    $productFamilleId,
                    $dry,
                    $createdProducts,
                    $restored,
                );

                if ($jalon === null || $product === null) {
                    // dry-run sans IDs réels : on simule le lien
                    if ($dry) {
                        $exists = JalonProduct::query()
                            ->whereHas('jalon', fn ($q) => $q->where('code', $jalonCode))
                            ->whereHas('product', fn ($q) => $q->where('code', $productCode))
                            ->where('tache_code', $row['tache_code'])
                            ->exists();
                        if ($exists) {
                            $skippedLinks++;
                        } else {
                            $createdLinks++;
                        }
                    }

                    continue;
                }

                $existing = JalonProduct::query()
                    ->where('jalon_article_id', $jalon->id)
                    ->where('product_article_id', $product->id)
                    ->where('tache_code', $row['tache_code'])
                    ->first();

                if ($existing) {
                    $skippedLinks++;

                    continue;
                }

                if (! $dry) {
                    JalonProduct::query()->create([
                        'jalon_article_id' => $jalon->id,
                        'product_article_id' => $product->id,
                        'ordre' => $row['ordre'],
                        'tache_code' => $row['tache_code'],
                        'tache_label' => $row['tache_label'] !== '' ? $row['tache_label'] : null,
                    ]);
                }
                $createdLinks++;
            }
        };

        if ($dry) {
            $run();
        } else {
            DB::transaction($run);
        }

        $this->table(
            ['Metric', 'Count'],
            [
                ['CSV rows', count($rows)],
                ['Jalons créés', $createdJalons],
                ['Produits créés', $createdProducts],
                ['Articles restaurés (soft-deleted)', $restored],
                ['Liens jalon_products créés', $createdLinks],
                ['Liens déjà présents (skip)', $skippedLinks],
                ['Lignes ignorées (codes vides)', $missingSkipped],
            ]
        );

        if ($dry) {
            $this->comment('Dry-run : aucune écriture en base.');
        }

        return self::SUCCESS;
    }

    /**
     * @param  \Illuminate\Support\Collection<string, Article>  $cache
     */
    private function ensureArticle(
        $cache,
        string $code,
        string $label,
        string $kind,
        int $familleId,
        bool $dry,
        int &$created,
        int &$restored,
    ): ?Article {
        /** @var Article|null $existing */
        $existing = $cache->get($code);
        if ($existing) {
            if ($existing->trashed()) {
                if (! $dry) {
                    $existing->restore();
                    if ($existing->kind !== $kind) {
                        $existing->forceFill(['kind' => $kind])->save();
                    }
                }
                $restored++;
            }

            return $existing;
        }

        $created++;
        if ($dry) {
            return null;
        }

        $article = Article::query()->create([
            'ref_famille_article_id' => $familleId,
            'code' => $code,
            'libelle' => Str::limit($label, 500, ''),
            'tags' => null,
            'unite' => 'U',
            'prix_unitaire_ht' => 0,
            'tva_rate' => 20,
            'duree_estimee' => 0,
            'actif' => true,
            'kind' => $kind,
        ]);
        $cache->put($code, $article);

        return $article;
    }

    private function resolveFamilleId(string $libelle): int
    {
        $baseCode = 'S2G-'.Str::upper(Str::slug(Str::substr($libelle, 0, 48)));
        $code = $baseCode;
        $suffix = 1;
        while (
            FamilleArticle::query()->where('code', $code)->where('libelle', '!=', $libelle)->exists()
        ) {
            $code = $baseCode.'-'.$suffix;
            $suffix++;
        }

        $famille = FamilleArticle::query()->firstOrCreate(
            ['libelle' => $libelle],
            [
                'code' => $code,
                'ordre' => 900,
                'actif' => true,
            ]
        );

        return (int) $famille->id;
    }

    /**
     * @return list<array{jalon_code: string, jalon_label: string, product_code: string, product_label: string, ordre: int, tache_code: string, tache_label: string}>
     */
    private function parseCsv(string $path): array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return [];
        }

        $header = null;
        $out = [];
        while (($data = fgetcsv($handle)) !== false) {
            if ($header === null) {
                $header = array_map(static fn ($h) => trim((string) $h, "\xEF\xBB\xBF \t"), $data);

                continue;
            }
            if (count(array_filter($data, static fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }
            $row = [];
            foreach ($header as $i => $key) {
                $row[$key] = isset($data[$i]) ? (string) $data[$i] : '';
            }

            $jalonCode = $this->csvValue($row, ['Code Article', 'CodeArticle']);
            $jalonLabel = $this->csvValue($row, ['Libelle Article', 'LibelleArticle']);
            $productCode = $this->csvValue($row, ['Code Descriptif Commercial', 'CodeDescriptifCommercial']);
            $productLabel = $this->csvValue($row, [
                'Libelle Descriptif Commecial',
                'Libelle Descriptif Commercial',
                'LibelleDescriptifCommecial',
                'LibelleDescriptifCommercial',
            ]);
            $tacheCode = $this->csvValue($row, ['Code Taches', 'CodeTaches', 'Code Tache', 'CodeTache']);
            $tacheLabel = $this->csvValue($row, ['Libelle Tache', 'LibelleTache']);

            $out[] = [
                'jalon_code' => $jalonCode,
                'jalon_label' => preg_replace('/\s+/u', ' ', $jalonLabel) ?? '',
                'product_code' => $productCode,
                'product_label' => preg_replace('/\s+/u', ' ', $productLabel) ?? '',
                'ordre' => (int) ((float) ($row['Ordre'] ?? 0)),
                'tache_code' => $tacheCode,
                'tache_label' => preg_replace('/\s+/u', ' ', $tacheLabel) ?? '',
            ];
        }
        fclose($handle);

        return $out;
    }

    /**
     * @param  array<string, string>  $row
     * @param  list<string>  $keys
     */
    private function csvValue(array $row, array $keys): string
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $row) && trim($row[$key]) !== '') {
                return trim($row[$key]);
            }
        }

        return '';
    }
}
