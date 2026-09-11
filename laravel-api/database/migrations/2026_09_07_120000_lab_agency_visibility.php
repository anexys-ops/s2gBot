<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Visibilité multi-agences labo :
 * - clients visibles par agence(s) S2G
 * - articles catalogue multi-site ou par agence(s)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_lab_agency', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['client_id', 'agency_id']);
        });

        Schema::create('article_lab_agency', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['article_id', 'agency_id']);
        });

        if (Schema::hasTable('ref_articles') && ! Schema::hasColumn('ref_articles', 'is_multi_site')) {
            Schema::table('ref_articles', function (Blueprint $table) {
                $table->boolean('is_multi_site')->default(true)->after('actif');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ref_articles') && Schema::hasColumn('ref_articles', 'is_multi_site')) {
            Schema::table('ref_articles', function (Blueprint $table) {
                $table->dropColumn('is_multi_site');
            });
        }
        Schema::dropIfExists('article_lab_agency');
        Schema::dropIfExists('client_lab_agency');
    }
};
