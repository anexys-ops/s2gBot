<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ref_resultats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->string('code');
            $table->string('libelle');
            $table->string('norme')->nullable();
            $table->decimal('valeur_seuil', 12, 4)->nullable();
            $table->timestamps();
            $table->unique(['ref_article_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ref_resultats');
    }
};
