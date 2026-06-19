<?php

namespace App\Console\Commands;

use Database\Seeders\S2gCatalogueSeeder;
use Illuminate\Console\Command;

class ImportS2gCatalogue extends Command
{
    protected $signature = 'catalogue:import-s2g
                            {--force : Exécuter sans confirmation interactive}';

    protected $description = 'Supprime tous les articles existants et importe le catalogue S2G (tags, jalons, produits)';

    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm(
            'Cette commande supprime TOUS les articles du catalogue puis importe le jeu S2G. Continuer ?',
            false
        )) {
            $this->warn('Import S2G annulé.');

            return self::SUCCESS;
        }

        $this->warn('Import catalogue S2G — purge des articles existants…');

        $seeder = new S2gCatalogueSeeder;
        $seeder->setCommand($this);
        $seeder->run();

        $this->info('Import catalogue S2G terminé.');

        return self::SUCCESS;
    }
}
