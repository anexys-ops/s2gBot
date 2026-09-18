<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rapport_bcs', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 40)->unique();
            $table->string('titre')->nullable();
            $table->string('statut', 30)->default('brouillon');
            $table->foreignId('bon_commande_id')->constrained('bons_commande')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rapport_bcs');
    }
};
