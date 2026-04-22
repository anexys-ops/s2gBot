<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('quote_lines')) {
            if (! Schema::hasColumn('quote_lines', 'ref_article_id')) {
                Schema::table('quote_lines', function (Blueprint $table) {
                    $table->foreignId('ref_article_id')
                        ->nullable()
                        ->after('commercial_offering_id')
                        ->constrained('ref_articles')
                        ->nullOnDelete();
                });
            }
            if (! Schema::hasColumn('quote_lines', 'ref_package_id')) {
                Schema::table('quote_lines', function (Blueprint $table) {
                    $table->foreignId('ref_package_id')
                        ->nullable()
                        ->after('ref_article_id')
                        ->constrained('ref_packages')
                        ->nullOnDelete();
                });
            }
        }

        if (! Schema::hasTable('devis_taches')) {
            Schema::create('devis_taches', function (Blueprint $table) {
                $table->id();
                $table->foreignId('quote_id')->constrained('quotes')->cascadeOnDelete();
                $table->foreignId('ref_tache_id')->constrained('ref_taches');
                $table->string('libelle')->nullable();
                $table->unsignedInteger('quantite')->default(1);
                $table->decimal('prix_unitaire_ht', 10, 2);
                $table->string('statut', 32)->default('a_faire');
                $table->unsignedInteger('ordre')->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('devis_taches')) {
            Schema::dropIfExists('devis_taches');
        }

        if (Schema::hasTable('quote_lines')) {
            if (Schema::hasColumn('quote_lines', 'ref_package_id')) {
                Schema::table('quote_lines', function (Blueprint $table) {
                    $table->dropConstrainedForeignId('ref_package_id');
                });
            }
            if (Schema::hasColumn('quote_lines', 'ref_article_id')) {
                Schema::table('quote_lines', function (Blueprint $table) {
                    $table->dropConstrainedForeignId('ref_article_id');
                });
            }
        }
    }
};
