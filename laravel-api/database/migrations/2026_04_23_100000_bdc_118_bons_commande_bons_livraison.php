<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bons_commande')) {
            Schema::create('bons_commande', function (Blueprint $table) {
                $table->id();
                $table->string('numero')->unique();
                $table->foreignId('quote_id')->nullable()->constrained('quotes')->nullOnDelete();
                $table->foreignId('dossier_id')->constrained('dossiers')->cascadeOnDelete();
                $table->foreignId('client_id')->constrained()->cascadeOnDelete();
                $table->string('statut', 32)->default('brouillon');
                $table->date('date_commande');
                $table->date('date_livraison_prevue')->nullable();
                $table->decimal('montant_ht', 12, 2)->default(0);
                $table->decimal('montant_ttc', 12, 2)->default(0);
                $table->decimal('tva_rate', 5, 2)->default(20);
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('bons_commande_lignes')) {
            Schema::create('bons_commande_lignes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('bon_commande_id')->constrained('bons_commande')->cascadeOnDelete();
                $table->foreignId('ref_article_id')->nullable()->constrained('ref_articles')->nullOnDelete();
                $table->string('libelle');
                $table->unsignedInteger('ordre')->default(0);
                $table->decimal('quantite', 12, 3)->default(0);
                $table->decimal('prix_unitaire_ht', 12, 2)->default(0);
                $table->decimal('tva_rate', 5, 2)->default(20);
                $table->decimal('montant_ht', 12, 2)->default(0);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('bons_livraison')) {
            Schema::create('bons_livraison', function (Blueprint $table) {
                $table->id();
                $table->string('numero')->unique();
                $table->foreignId('bon_commande_id')->nullable()->constrained('bons_commande')->nullOnDelete();
                $table->foreignId('dossier_id')->constrained('dossiers')->cascadeOnDelete();
                $table->foreignId('client_id')->constrained()->cascadeOnDelete();
                $table->string('statut', 32)->default('brouillon');
                $table->date('date_livraison');
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('bons_livraison_lignes')) {
            Schema::create('bons_livraison_lignes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('bon_livraison_id')->constrained('bons_livraison')->cascadeOnDelete();
                $table->foreignId('bon_commande_ligne_id')->nullable()
                    ->constrained('bons_commande_lignes')->nullOnDelete();
                $table->foreignId('ref_article_id')->nullable()->constrained('ref_articles')->nullOnDelete();
                $table->string('libelle');
                $table->decimal('quantite_livree', 12, 3)->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bons_livraison_lignes');
        Schema::dropIfExists('bons_livraison');
        Schema::dropIfExists('bons_commande_lignes');
        Schema::dropIfExists('bons_commande');
    }
};
