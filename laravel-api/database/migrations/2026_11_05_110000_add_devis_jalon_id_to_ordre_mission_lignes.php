<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rattachement d'une tâche ajoutée à la main à un jalon du devis (id de quote.meta.devis_jalons) :
 * sans ligne de BC source, c'est la seule façon de la regrouper sous son jalon.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('ordre_mission_lignes', 'devis_jalon_id')) {
            return;
        }
        Schema::table('ordre_mission_lignes', function (Blueprint $table) {
            $table->string('devis_jalon_id', 64)->nullable()->after('bon_commande_ligne_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('ordre_mission_lignes', 'devis_jalon_id')) {
            return;
        }
        Schema::table('ordre_mission_lignes', function (Blueprint $table) {
            $table->dropColumn('devis_jalon_id');
        });
    }
};
