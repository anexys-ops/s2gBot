<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qualification_tags', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('label');
            $table->string('groupe', 8);
            $table->timestamps();
        });

        if (Schema::hasTable('ref_articles')) {
            Schema::table('ref_articles', function (Blueprint $table) {
                if (! Schema::hasColumn('ref_articles', 'kind')) {
                    $table->string('kind', 16)->default('legacy')->after('actif')
                        ->comment('jalon | product | legacy');
                }
                if (! Schema::hasColumn('ref_articles', 'famille_label')) {
                    $table->string('famille_label', 255)->nullable()->after('kind')
                        ->comment('Libellé famille legacy S2G (jalons)');
                }
            });
        }

        Schema::create('qualification_tag_jalon', function (Blueprint $table) {
            $table->id();
            $table->foreignId('qualification_tag_id')->constrained('qualification_tags')->cascadeOnDelete();
            $table->foreignId('jalon_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->unique(['qualification_tag_id', 'jalon_article_id'], 'qualification_tag_jalon_unique');
        });

        Schema::create('jalon_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('jalon_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->foreignId('product_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->unsignedSmallInteger('ordre')->default(0);
            $table->string('tache_code', 64)->nullable();
            $table->string('tache_label', 255)->nullable();
            $table->timestamps();
            $table->unique(
                ['jalon_article_id', 'product_article_id', 'tache_code'],
                'jalon_products_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jalon_products');
        Schema::dropIfExists('qualification_tag_jalon');
        Schema::table('ref_articles', function (Blueprint $table) {
            foreach (['famille_label', 'kind'] as $col) {
                if (Schema::hasColumn('ref_articles', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        Schema::dropIfExists('qualification_tags');
    }
};
