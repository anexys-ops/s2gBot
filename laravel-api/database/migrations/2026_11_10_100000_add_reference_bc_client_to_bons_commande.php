<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Référence du bon de commande communiquée par le client, ou « À l'ordre de <personne> »
 * tant que le document officiel n'est pas reçu.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bons_commande', 'reference_bc_client')) {
            return;
        }
        Schema::table('bons_commande', function (Blueprint $table) {
            $table->string('reference_bc_client', 191)->nullable()->after('bc_client_recu_le');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('bons_commande', 'reference_bc_client')) {
            return;
        }
        Schema::table('bons_commande', function (Blueprint $table) {
            $table->dropColumn('reference_bc_client');
        });
    }
};
