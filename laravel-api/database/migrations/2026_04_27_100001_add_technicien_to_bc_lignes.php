<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Garde-fou : la migration précédente (2026_04_22_140000_bc_ligne_planning_terrain)
        // est censée créer date_debut_prevue / date_fin_prevue. Si elle a échoué
        // ou n'a pas tourné (migration partielle, prod cassée), on les recrée ici
        // avant le ->after('date_fin_prevue').
        if (Schema::hasTable('bons_commande_lignes')) {
            Schema::table('bons_commande_lignes', function (Blueprint $table) {
                if (! Schema::hasColumn('bons_commande_lignes', 'date_debut_prevue')) {
                    $table->date('date_debut_prevue')->nullable();
                }
                if (! Schema::hasColumn('bons_commande_lignes', 'date_fin_prevue')) {
                    $table->date('date_fin_prevue')->nullable();
                }
            });
        }

        Schema::table('bons_commande_lignes', function (Blueprint $table) {
            if (!Schema::hasColumn('bons_commande_lignes', 'technicien_id')) {
                // Pas de ->after('date_fin_prevue') : si la colonne n'existait pas
                // sur certains environnements (état partiel), MySQL renvoyait
                // "Column not found: date_fin_prevue" et bloquait le déploiement.
                $table->foreignId('technicien_id')->nullable()
                    ->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('bons_commande_lignes', 'date_livraison')) {
                $table->date('date_livraison')->nullable();
            }
            if (!Schema::hasColumn('bons_commande_lignes', 'notes_ligne')) {
                $table->string('notes_ligne', 500)->nullable();
            }
        });
    }
    public function down(): void {
        Schema::table('bons_commande_lignes', function (Blueprint $table) {
            if (Schema::hasColumn('bons_commande_lignes', 'technicien_id')) {
                $table->dropConstrainedForeignId('technicien_id');
            }
            $cols = array_filter(['date_livraison', 'notes_ligne'], fn ($c) => Schema::hasColumn('bons_commande_lignes', $c));
            if ($cols) {
                $table->dropColumn($cols);
            }
        });
    }
};
