<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('odm_jalon_quantities_generated', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bon_commande_ligne_id')->constrained('bons_commande_lignes')->cascadeOnDelete();
            $table->decimal('quantite_generee', 10, 3)->default(0);
            $table->timestamps();
            $table->unique('bon_commande_ligne_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('odm_jalon_quantities_generated');
    }
};
