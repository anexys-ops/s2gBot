<?php

namespace App\Console\Commands;

use App\Models\JalonProduct;
use Illuminate\Console\Command;

/**
 * Supprime les liens jalon_products sans tâche créés par erreur en doublon
 * d’un couple jalon↔produit qui a déjà une tâche.
 */
class CleanupEmptyTacheJalonProducts extends Command
{
    protected $signature = 'catalogue:cleanup-empty-tache-links {--dry-run : Compter sans supprimer}';

    protected $description = 'Supprime les liens jalon_products à tache_code vide/null qui doublonnent un couple jalon+produit déjà lié';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        $query = JalonProduct::query()
            ->where(function ($q): void {
                $q->whereNull('tache_code')->orWhere('tache_code', '');
            })
            ->whereExists(function ($q): void {
                $q->selectRaw('1')
                    ->from('jalon_products as jp2')
                    ->whereColumn('jp2.jalon_article_id', 'jalon_products.jalon_article_id')
                    ->whereColumn('jp2.product_article_id', 'jalon_products.product_article_id')
                    ->whereNotNull('jp2.tache_code')
                    ->where('jp2.tache_code', '!=', '')
                    ->whereColumn('jp2.id', '!=', 'jalon_products.id');
            });

        $dupEmpty = (clone $query)->count();

        // Liens sans tâche qui n’ont PAS de doublon avec tâche : à conserver (nouveaux couples).
        $keepEmpty = JalonProduct::query()
            ->where(function ($q): void {
                $q->whereNull('tache_code')->orWhere('tache_code', '');
            })
            ->whereNotExists(function ($q): void {
                $q->selectRaw('1')
                    ->from('jalon_products as jp2')
                    ->whereColumn('jp2.jalon_article_id', 'jalon_products.jalon_article_id')
                    ->whereColumn('jp2.product_article_id', 'jalon_products.product_article_id')
                    ->whereNotNull('jp2.tache_code')
                    ->where('jp2.tache_code', '!=', '')
                    ->whereColumn('jp2.id', '!=', 'jalon_products.id');
            })
            ->count();

        $this->table(
            ['Metric', 'Count'],
            [
                ['Empty-tache links that DUPLICATE a tache link (to delete)', $dupEmpty],
                ['Empty-tache links that are unique couples (keep)', $keepEmpty],
            ]
        );

        if ($dry) {
            $this->comment('Dry-run : aucune suppression.');

            return self::SUCCESS;
        }

        $ids = $query->pluck('id');
        $deleted = 0;
        foreach ($ids->chunk(500) as $chunk) {
            $deleted += JalonProduct::query()->whereIn('id', $chunk->all())->delete();
        }
        $this->info("Supprimé : {$deleted} lien(s) vides en doublon.");

        return self::SUCCESS;
    }
}
