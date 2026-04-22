<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ref_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_famille_article_id')->constrained('ref_famille_articles')->cascadeOnDelete();
            $table->string('code')->unique();
            $table->string('libelle');
            $table->text('description')->nullable();
            $table->string('unite', 32)->default('U');
            $table->decimal('prix_unitaire_ht', 10, 2)->default(0);
            $table->decimal('tva_rate', 5, 2)->default(20);
            $table->unsignedInteger('duree_estimee')->default(0)->comment('Minutes');
            $table->text('normes')->nullable();
            $table->boolean('actif')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ref_articles');
    }
};
