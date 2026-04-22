<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ref_famille_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->string('code');
            $table->string('libelle');
            $table->text('description')->nullable();
            $table->unsignedInteger('ordre')->default(0);
            $table->boolean('actif')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['ref_article_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ref_famille_packages');
    }
};
