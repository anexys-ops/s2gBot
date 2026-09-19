<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bon_livraison_rapport_bcs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bon_livraison_id')->constrained('bons_livraison')->cascadeOnDelete();
            $table->foreignId('rapport_bc_id')->constrained('rapport_bcs')->cascadeOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['bon_livraison_id', 'rapport_bc_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bon_livraison_rapport_bcs');
    }
};
