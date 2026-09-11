<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            if (! Schema::hasColumn('samples', 'bon_commande_ligne_id')) {
                $table->foreignId('bon_commande_ligne_id')->nullable()->after('product_id')
                    ->constrained('bons_commande_lignes')->nullOnDelete()
                    ->comment('Ligne BC à l’origine du prélèvement');
            }
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            if (Schema::hasColumn('samples', 'bon_commande_ligne_id')) {
                $table->dropForeign(['bon_commande_ligne_id']);
                $table->dropColumn('bon_commande_ligne_id');
            }
        });
    }
};
