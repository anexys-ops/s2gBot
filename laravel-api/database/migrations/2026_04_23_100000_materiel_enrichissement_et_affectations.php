<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Enrichissement du module Matériel :
 *  1. ALTER TABLE equipments — champs manquants (inventaire, catégorie, prix, garantie, catalogue)
 *  2. CREATE TABLE materiel_affectations — suivi affectation par dossier/mission
 *  3. CREATE TABLE materiel_frais — frais liés à un matériel / dossier (déplacement, consommables)
 */
return new class extends Migration
{
    public function up(): void
    {
        // ----------------------------------------------------------------
        // 1. Enrichissement table equipments
        // ----------------------------------------------------------------
        Schema::table('equipments', function (Blueprint $table) {
            // Numéro inventaire unique (ex: MAT-2024-0023)
            if (! Schema::hasColumn('equipments', 'numero_inventaire')) {
                $table->string('numero_inventaire', 64)->nullable()->unique()->after('code');
            }
            // Catégorie
            if (! Schema::hasColumn('equipments', 'categorie')) {
                $table->enum('categorie', [
                    'appareil_mesure',
                    'vehicule',
                    'outil_terrain',
                    'informatique',
                    'laboratoire',
                    'securite',
                    'autre',
                ])->default('appareil_mesure')->after('type');
            }
            // Lien catalogue (essai associé)
            if (! Schema::hasColumn('equipments', 'ref_article_id')) {
                $table->foreignId('ref_article_id')
                    ->nullable()
                    ->after('categorie')
                    ->constrained('ref_articles')
                    ->nullOnDelete();
            }
            // Informations financières
            if (! Schema::hasColumn('equipments', 'valeur_acquisition_ht')) {
                $table->decimal('valeur_acquisition_ht', 12, 2)->nullable()->after('purchase_date');
            }
            if (! Schema::hasColumn('equipments', 'fournisseur')) {
                $table->string('fournisseur', 191)->nullable()->after('valeur_acquisition_ht');
            }
            if (! Schema::hasColumn('equipments', 'reference_fournisseur')) {
                $table->string('reference_fournisseur', 128)->nullable()->after('fournisseur');
            }
            // Garantie
            if (! Schema::hasColumn('equipments', 'garantie_fin')) {
                $table->date('garantie_fin')->nullable()->after('reference_fournisseur');
            }
            // Localisation détaillée
            if (! Schema::hasColumn('equipments', 'localisation_detail')) {
                $table->string('localisation_detail', 191)->nullable()->after('location')
                    ->comment('Ex: Armoire A3, Étagère 2');
            }
            // Média
            if (! Schema::hasColumn('equipments', 'photo_path')) {
                $table->string('photo_path', 512)->nullable();
            }
            if (! Schema::hasColumn('equipments', 'qr_code')) {
                $table->string('qr_code', 128)->nullable()->unique();
            }
            // Notes internes
            if (! Schema::hasColumn('equipments', 'notes')) {
                $table->text('notes')->nullable();
            }
            // Statut étendu (ajouter 'affecte' et 'hors_service')
            // On garde la colonne existante (varchar 32) et on documente les nouvelles valeurs
            // active | maintenance | retired | affecte | hors_service

            // Soft deletes
            if (! Schema::hasColumn('equipments', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        // ----------------------------------------------------------------
        // 2. Table affectations matériel ↔ dossier/mission
        // ----------------------------------------------------------------
        if (! Schema::hasTable('materiel_affectations')) {
            Schema::create('materiel_affectations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
                $table->foreignId('dossier_id')->nullable()->constrained('dossiers')->nullOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete()
                    ->comment('Technicien responsable');
                // Lien ordre de mission (si module actif)
                $table->unsignedBigInteger('ordre_mission_id')->nullable()
                    ->comment('FK ordres_mission — nullable car table non encore créée');
                $table->date('date_debut');
                $table->date('date_retour_prevue')->nullable();
                $table->date('date_retour_effective')->nullable();
                $table->enum('etat_depart', ['bon', 'usage', 'degrade'])->default('bon');
                $table->enum('etat_retour', ['bon', 'usage', 'degrade'])->nullable();
                $table->text('observations')->nullable();
                $table->timestamps();

                $table->index(['equipment_id', 'date_debut']);
                $table->index(['dossier_id']);
            });
        }

        // ----------------------------------------------------------------
        // 3. Table frais matériel / déplacements par dossier
        // ----------------------------------------------------------------
        if (! Schema::hasTable('materiel_frais')) {
            Schema::create('materiel_frais', function (Blueprint $table) {
                $table->id();
                $table->foreignId('equipment_id')->nullable()->constrained('equipments')->nullOnDelete();
                $table->foreignId('dossier_id')->nullable()->constrained('dossiers')->nullOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete()
                    ->comment('Technicien qui a engagé la dépense');
                $table->date('date_depense');
                $table->enum('type_frais', [
                    'deplacement',    // km voiture, taxi, train
                    'carburant',
                    'peage',
                    'hebergement',
                    'repas',
                    'consommable',    // pièce, fourniture pour le matériel
                    'reparation',
                    'autre',
                ])->default('deplacement');
                $table->string('description', 255);
                $table->decimal('montant_ht', 10, 2);
                $table->decimal('tva_rate', 5, 2)->default(20);
                $table->decimal('montant_ttc', 10, 2)->virtualAs('ROUND(montant_ht * (1 + tva_rate / 100), 2)');
                $table->string('justificatif_path', 512)->nullable();
                // Km si déplacement
                $table->unsignedInteger('km')->nullable();
                $table->decimal('cout_km', 5, 3)->nullable()->comment('€ ou MAD par km');
                $table->timestamps();

                $table->index(['dossier_id', 'date_depense']);
                $table->index(['user_id', 'date_depense']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('materiel_frais');
        Schema::dropIfExists('materiel_affectations');

        Schema::table('equipments', function (Blueprint $table) {
            $cols = [
                'numero_inventaire', 'categorie', 'ref_article_id',
                'valeur_acquisition_ht', 'fournisseur', 'reference_fournisseur',
                'garantie_fin', 'localisation_detail', 'photo_path', 'qr_code',
                'notes', 'deleted_at',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('equipments', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
