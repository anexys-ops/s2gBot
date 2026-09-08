<?php

use App\Support\CatalogueVisibilityRestore;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        CatalogueVisibilityRestore::run();
    }

    public function down(): void
    {
        // Correction de données — pas de retour arrière automatique.
    }
};
