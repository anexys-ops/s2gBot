<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Produits S2G assignés par section (technicien / ingénieur / labo) sur une fiche jalon ou produit.
 * Prépare l’affichage futur dans les devis lors de la sélection d’un jalon.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_section_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->foreignId('product_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->string('section_type', 32)->comment('technicien|ingenieur|labo');
            $table->unsignedSmallInteger('ordre')->default(0);
            $table->timestamps();

            $table->unique(
                ['ref_article_id', 'product_article_id', 'section_type'],
                'article_section_products_unique'
            );
            $table->index(['ref_article_id', 'section_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_section_products');
    }
};
