<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bons_commande_lignes')) {
            Schema::table('bons_commande_lignes', function (Blueprint $table) {
                if (! Schema::hasColumn('bons_commande_lignes', 'date_debut_prevue')) {
                    $table->date('date_debut_prevue')->nullable()->after('montant_ht');
                }
                if (! Schema::hasColumn('bons_commande_lignes', 'date_fin_prevue')) {
                    $table->date('date_fin_prevue')->nullable();
                }
            });
        }

        if (! Schema::hasTable('bc_ligne_planning_affectations')) {
            Schema::create('bc_ligne_planning_affectations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('bon_commande_ligne_id')->constrained('bons_commande_lignes')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->date('date_debut');
                $table->date('date_fin');
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['date_debut', 'date_fin']);
                $table->index('user_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bc_ligne_planning_affectations');

        if (Schema::hasTable('bons_commande_lignes') && Schema::hasColumn('bons_commande_lignes', 'date_debut_prevue')) {
            Schema::table('bons_commande_lignes', function (Blueprint $table) {
                $table->dropColumn(['date_debut_prevue', 'date_fin_prevue']);
            });
        }
    }
};
