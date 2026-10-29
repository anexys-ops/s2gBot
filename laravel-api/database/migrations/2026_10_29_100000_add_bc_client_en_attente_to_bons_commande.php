<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bons_commande', function (Blueprint $table) {
            $table->boolean('bc_client_en_attente')->default(false)->after('statut');
            $table->date('bc_client_recu_le')->nullable()->after('bc_client_en_attente');
            $table->index('bc_client_en_attente');
        });
    }

    public function down(): void
    {
        Schema::table('bons_commande', function (Blueprint $table) {
            $table->dropIndex(['bc_client_en_attente']);
            $table->dropColumn(['bc_client_en_attente', 'bc_client_recu_le']);
        });
    }
};
