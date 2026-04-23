<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ref_articles', function (Blueprint $table) {
            if (! Schema::hasColumn('ref_articles', 'code_interne')) {
                $table->string('code_interne', 64)->nullable()->after('code');
            }
            if (! Schema::hasColumn('ref_articles', 'sku')) {
                $table->string('sku', 64)->nullable()->after('code_interne');
            }
            if (! Schema::hasColumn('ref_articles', 'prix_revient_ht')) {
                $table->decimal('prix_revient_ht', 10, 2)->nullable()->after('prix_unitaire_ht');
            }
            if (! Schema::hasColumn('ref_articles', 'description_commerciale')) {
                $table->text('description_commerciale')->nullable()->after('libelle');
            }
            if (! Schema::hasColumn('ref_articles', 'description_technique')) {
                $table->text('description_technique')->nullable()->after('description_commerciale');
            }
            if (! Schema::hasColumn('ref_articles', 'tags')) {
                $table->json('tags')->nullable()->after('description_technique');
            }
            if (! Schema::hasColumn('ref_articles', 'hfsql_unite')) {
                $table->string('hfsql_unite', 64)->nullable()->after('unite');
            }
            if (! Schema::hasColumn('ref_articles', 'ref_article_lie_id')) {
                $table->foreignId('ref_article_lie_id')
                    ->nullable()
                    ->after('ref_famille_article_id')
                    ->constrained('ref_articles')
                    ->nullOnDelete();
            }
        });

        if (Schema::hasColumn('ref_articles', 'description_commerciale') && Schema::hasColumn('ref_articles', 'description')) {
            DB::table('ref_articles')
                ->whereNotNull('description')
                ->whereNull('description_commerciale')
                ->update(['description_commerciale' => DB::raw('description')]);
        }
    }

    public function down(): void
    {
        Schema::table('ref_articles', function (Blueprint $table) {
            if (Schema::hasColumn('ref_articles', 'ref_article_lie_id')) {
                $table->dropConstrainedForeignId('ref_article_lie_id');
            }
            $cols = ['code_interne', 'sku', 'prix_revient_ht', 'description_commerciale', 'description_technique', 'tags', 'hfsql_unite'];
            foreach ($cols as $c) {
                if (Schema::hasColumn('ref_articles', $c)) {
                    $table->dropColumn($c);
                }
            }
        });
    }
};
