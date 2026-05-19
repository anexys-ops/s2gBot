<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration 4 — Table article_compositions
 *
 * Composition d'articles (nomenclature / BOM) :
 * un article parent peut être composé de plusieurs articles enfants.
 *
 * Colonnes :
 *  - parent_article_id : article composite (FK ref_articles, cascade delete)
 *  - child_article_id  : composant (FK ref_articles, cascade delete)
 *  - qty_per_unit      : quantité de composant par unité de parent
 *  - is_optional       : composant optionnel ou obligatoire
 *  - ordre             : ordre d'affichage
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('article_compositions')) {
            Schema::create('article_compositions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('parent_article_id');
                $table->unsignedBigInteger('child_article_id');
                $table->unsignedSmallInteger('qty_per_unit')->default(1);
                $table->boolean('is_optional')->default(false);
                $table->unsignedSmallInteger('ordre')->default(0);
                $table->timestamps();

                $table->foreign('parent_article_id')
                    ->references('id')
                    ->on('ref_articles')
                    ->cascadeOnDelete();
                $table->foreign('child_article_id')
                    ->references('id')
                    ->on('ref_articles')
                    ->cascadeOnDelete();

                $table->unique(['parent_article_id', 'child_article_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('article_compositions');
    }
};
