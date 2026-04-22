<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ref_parametres_essai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->string('code');
            $table->string('libelle');
            $table->string('unite', 32)->nullable();
            $table->decimal('valeur_min', 12, 4)->nullable();
            $table->decimal('valeur_max', 12, 4)->nullable();
            $table->unsignedInteger('ordre')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['ref_article_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ref_parametres_essai');
    }
};
