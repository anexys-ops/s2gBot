<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * v1.2.0 — Menu RÉCEPTION
 *
 * Étend la table `samples` (existante) avec les colonnes nécessaires au flux
 * de réception des échantillons (FOLD, dossier, OdM, tâche, produit, condition,
 * stockage, photo, etc.). Les colonnes historiques (reference, depth_top_m,
 * depth_bottom_m, statut pending/received/...) restent en place pour la
 * compatibilité ascendante.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            if (! Schema::hasColumn('samples', 'fold_number')) {
                $table->string('fold_number', 32)->nullable()->unique()->after('id')
                    ->comment('Numéro unique 8 chiffres FOLD-XXXXXXXX');
            }
            if (! Schema::hasColumn('samples', 'dossier_id')) {
                $table->foreignId('dossier_id')->nullable()->after('fold_number')
                    ->constrained('dossiers')->nullOnDelete();
            }
            if (! Schema::hasColumn('samples', 'mission_order_id')) {
                $table->foreignId('mission_order_id')->nullable()->after('dossier_id')
                    ->constrained('ordres_mission')->nullOnDelete()
                    ->comment('Ordre de mission terrain à l’origine du prélèvement');
            }
            if (! Schema::hasColumn('samples', 'task_id')) {
                $table->foreignId('task_id')->nullable()->after('mission_order_id')
                    ->constrained('mission_tasks')->nullOnDelete()
                    ->comment('Tâche de prélèvement (mission_tasks)');
            }
            if (! Schema::hasColumn('samples', 'product_id')) {
                $table->foreignId('product_id')->nullable()->after('task_id')
                    ->constrained('ref_articles')->nullOnDelete()
                    ->comment('Type d’essai prévu — ref_articles');
            }
            if (! Schema::hasColumn('samples', 'description')) {
                $table->text('description')->nullable()->after('reference');
            }
            if (! Schema::hasColumn('samples', 'sample_type')) {
                $table->string('sample_type', 32)->nullable()->after('description')
                    ->comment('sol|eau|beton|granulat|roche|enrobe|autre');
            }
            if (! Schema::hasColumn('samples', 'origin_location')) {
                $table->string('origin_location', 255)->nullable()->after('sample_type')
                    ->comment('Lieu de prélèvement — texte libre ou GPS lat,lng');
            }
            if (! Schema::hasColumn('samples', 'depth_m')) {
                $table->decimal('depth_m', 8, 3)->nullable()->after('origin_location')
                    ->comment('Profondeur en mètres (champ unique, voir aussi depth_top_m / depth_bottom_m)');
            }
            if (! Schema::hasColumn('samples', 'collected_by')) {
                $table->foreignId('collected_by')->nullable()->after('depth_m')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('samples', 'collected_at')) {
                $table->timestamp('collected_at')->nullable()->after('collected_by');
            }
            if (! Schema::hasColumn('samples', 'received_by')) {
                $table->foreignId('received_by')->nullable()->after('collected_at')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('samples', 'condition_state')) {
                $table->string('condition_state', 32)->nullable()->after('received_by')
                    ->comment('bon|endommage|insuffisant');
            }
            if (! Schema::hasColumn('samples', 'storage_location')) {
                $table->string('storage_location', 191)->nullable()->after('condition_state')
                    ->comment('Emplacement physique — ex. Salle B / Étagère 3');
            }
            if (! Schema::hasColumn('samples', 'photo_path')) {
                $table->string('photo_path', 512)->nullable()->after('storage_location');
            }
            if (! Schema::hasColumn('samples', 'weight_g')) {
                $table->decimal('weight_g', 12, 2)->nullable()->after('photo_path')
                    ->comment('Poids en grammes');
            }
            if (! Schema::hasColumn('samples', 'quantity')) {
                $table->unsignedInteger('quantity')->nullable()->after('weight_g')
                    ->comment('Nombre de sous-échantillons');
            }
            if (! Schema::hasColumn('samples', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable();
            }
        });

        // Le flux Réception crée des Sample sans OrderItem amont
        // (prélèvement terrain → réception). On rend la FK historique nullable
        // via du SQL natif pour éviter la dépendance doctrine/dbal (absente en
        // prod quand `composer install --no-dev` est utilisé).
        if (Schema::hasColumn('samples', 'order_item_id')) {
            try {
                $driver = Schema::getConnection()->getDriverName();
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    DB::statement('ALTER TABLE samples MODIFY order_item_id BIGINT UNSIGNED NULL');
                } elseif ($driver === 'pgsql') {
                    DB::statement('ALTER TABLE samples ALTER COLUMN order_item_id DROP NOT NULL');
                }
                // SQLite : pas d’ALTER COLUMN simple — on tolère.
            } catch (\Throwable $e) {
                // Driver inattendu / contrainte : on ignore, le contrôleur
                // pourra toujours créer un OrderItem placeholder si besoin.
            }
        }

        // Index utiles pour la recherche réception
        Schema::table('samples', function (Blueprint $table) {
            try {
                $table->index('status');
            } catch (\Throwable $e) {
                // index déjà existant — on ignore.
            }
            try {
                $table->index('sample_type');
            } catch (\Throwable $e) {
                // index déjà existant — on ignore.
            }
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $cols = [
                'rejection_reason', 'quantity', 'weight_g', 'photo_path',
                'storage_location', 'condition_state', 'received_by',
                'collected_at', 'collected_by', 'depth_m', 'origin_location',
                'sample_type', 'description',
            ];
            foreach ($cols as $c) {
                if (Schema::hasColumn('samples', $c)) {
                    $table->dropColumn($c);
                }
            }
            foreach (['product_id', 'task_id', 'mission_order_id', 'dossier_id'] as $fk) {
                if (Schema::hasColumn('samples', $fk)) {
                    try { $table->dropForeign([$fk]); } catch (\Throwable $e) {}
                    $table->dropColumn($fk);
                }
            }
            if (Schema::hasColumn('samples', 'fold_number')) {
                $table->dropUnique(['fold_number']);
                $table->dropColumn('fold_number');
            }
        });
    }
};
