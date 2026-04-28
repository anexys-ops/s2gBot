<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Feature : Ordres de mission — flux BC → OM labo/technicien/ingénieur
 *
 * Nouvelles tables :
 *  - article_actions               : actions par article (type technicien/ingenieur/labo)
 *  - article_equipment_requirements: matériel requis par article
 *  - ordres_mission                : ordres de mission générés depuis un BC
 *  - ordre_mission_lignes          : lignes de travail dans un ordre de mission
 *  - frais_deplacement             : frais de déplacement liés aux OMs technicien
 *
 * Enrichissements :
 *  - ref_famille_articles : + color, type_ressource
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Enrichir familles articles ───────────────────────────────────────
        Schema::table('ref_famille_articles', function (Blueprint $table) {
            $table->string('color', 7)->nullable()->after('description')->comment('Couleur hex ex. #3B82F6');
            $table->string('type_ressource', 32)->nullable()->after('color')
                ->comment('technicien|ingenieur|labo|mixte');
        });

        // ── Actions par article ──────────────────────────────────────────────
        Schema::create('article_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->string('type', 32)->comment('technicien|ingenieur|labo');
            $table->string('libelle', 255);
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('duree_heures')->default(0)->comment('Durée estimée en heures');
            $table->unsignedTinyInteger('ordre')->default(0);
            $table->timestamps();

            $table->index(['ref_article_id', 'type']);
        });

        // ── Matériel requis par article ──────────────────────────────────────
        Schema::create('article_equipment_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
            $table->unsignedSmallInteger('quantite')->default(1);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['ref_article_id', 'equipment_id']);
        });

        // ── Ordres de mission ────────────────────────────────────────────────
        Schema::create('ordres_mission', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 64)->unique();
            $table->foreignId('bon_commande_id')->constrained('bons_commande')->cascadeOnDelete();
            $table->foreignId('dossier_id')->nullable()->constrained('dossiers')->nullOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('site_id')->nullable()->constrained('sites')->nullOnDelete();
            $table->string('type', 32)->comment('labo|technicien|ingenieur');
            $table->string('statut', 32)->default('brouillon')
                ->comment('brouillon|planifie|en_cours|termine|annule');
            $table->date('date_prevue')->nullable();
            $table->date('date_debut')->nullable();
            $table->date('date_fin')->nullable();
            $table->foreignId('responsable_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['bon_commande_id', 'type']);
            $table->index(['statut', 'type']);
            $table->index('date_prevue');
        });

        // ── Lignes d'ordre de mission ────────────────────────────────────────
        Schema::create('ordre_mission_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ordre_mission_id')->constrained('ordres_mission')->cascadeOnDelete();
            $table->foreignId('bon_commande_ligne_id')->nullable()
                ->constrained('bons_commande_lignes')->nullOnDelete();
            $table->foreignId('ref_article_id')->nullable()->constrained('ref_articles')->nullOnDelete();
            $table->foreignId('article_action_id')->nullable()->constrained('article_actions')->nullOnDelete();
            $table->string('libelle', 255);
            $table->decimal('quantite', 10, 3)->default(1);
            $table->string('statut', 32)->default('a_faire')
                ->comment('a_faire|en_cours|realise|annule');
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('equipment_id')->nullable()->constrained('equipments')->nullOnDelete();
            $table->dateTime('date_prevue')->nullable();
            $table->dateTime('date_realisation')->nullable();
            $table->unsignedSmallInteger('duree_reelle_heures')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedTinyInteger('ordre')->default(0);
            $table->timestamps();

            $table->index(['ordre_mission_id', 'statut']);
        });

        // ── Frais de déplacement ─────────────────────────────────────────────
        Schema::create('frais_deplacement', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ordre_mission_id')->constrained('ordres_mission')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');
            $table->string('lieu_depart', 255)->nullable();
            $table->string('lieu_arrivee', 255)->nullable();
            $table->decimal('distance_km', 8, 2)->default(0);
            $table->decimal('taux_km', 6, 4)->default(0.4010)->comment('Taux kilométrique €/km');
            $table->decimal('montant', 10, 2)->storedAs('ROUND(distance_km * taux_km * 2, 2)')
                ->comment('Aller-retour calculé automatiquement');
            $table->string('type_transport', 32)->default('voiture')
                ->comment('voiture|moto|velo|transports_commun|autre');
            $table->text('notes')->nullable();
            $table->string('statut', 32)->default('draft')->comment('draft|valide|rembourse');
            $table->timestamps();

            $table->index(['ordre_mission_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('frais_deplacement');
        Schema::dropIfExists('ordre_mission_lignes');
        Schema::dropIfExists('ordres_mission');
        Schema::dropIfExists('article_equipment_requirements');
        Schema::dropIfExists('article_actions');

        Schema::table('ref_famille_articles', function (Blueprint $table) {
            $table->dropColumn(['color', 'type_ressource']);
        });
    }
};
