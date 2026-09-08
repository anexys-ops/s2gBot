<?php

namespace App\Console\Commands;

use App\Support\CatalogueVisibilityRestore;
use Illuminate\Console\Command;

class ActivateAllCatalogueArticles extends Command
{
    protected $signature = 'catalogue:activate-all';

    protected $description = 'Réactive tous les articles catalogue, familles et périmètre multi-site (siège)';

    public function handle(): int
    {
        $stats = CatalogueVisibilityRestore::run();

        $this->info(sprintf(
            'Catalogue réactivé : %d article(s), %d famille(s) actives, %d article(s) S2G restauré(s) (soft delete).',
            $stats['articles'],
            $stats['familles'],
            $stats['restored'],
        ));

        return self::SUCCESS;
    }
}
