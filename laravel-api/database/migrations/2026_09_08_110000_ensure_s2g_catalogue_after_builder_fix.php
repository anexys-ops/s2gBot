<?php

use App\Models\Catalogue\Article;
use App\Support\CatalogueVisibilityRestore;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

return new class extends Migration
{
    public function up(): void
    {
        CatalogueVisibilityRestore::run();

        if (! Article::hasS2gCatalogue()) {
            Artisan::call('catalogue:import-s2g', ['--force' => true]);
        }
    }

    public function down(): void
    {
        // Données catalogue — pas de retour arrière.
    }
};
