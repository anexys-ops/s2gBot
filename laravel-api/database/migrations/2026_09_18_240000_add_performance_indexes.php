<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes de performance — tables clés du domaine.
 * Couvre les patterns WHERE / ORDER BY les plus fréquents identifiés dans les controllers.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── rapport_bcs ──────────────────────────────────────────────────────
        // statut filtré seul + composite avec BC + tri par date
        Schema::table('rapport_bcs', function (Blueprint $table) {
            if (! $this->hasIndex('rapport_bcs', 'rapport_bcs_statut_index')) {
                $table->index('statut', 'rapport_bcs_statut_index');
            }
            if (! $this->hasIndex('rapport_bcs', 'rapport_bcs_bon_commande_id_statut_index')) {
                $table->index(['bon_commande_id', 'statut'], 'rapport_bcs_bon_commande_id_statut_index');
            }
            if (! $this->hasIndex('rapport_bcs', 'rapport_bcs_created_at_index')) {
                $table->index('created_at', 'rapport_bcs_created_at_index');
            }
        });

        // ── bons_commande ─────────────────────────────────────────────────────
        // statut seul + composites client+statut, dossier+statut + tri par date
        Schema::table('bons_commande', function (Blueprint $table) {
            if (! $this->hasIndex('bons_commande', 'bons_commande_statut_index')) {
                $table->index('statut', 'bons_commande_statut_index');
            }
            if (! $this->hasIndex('bons_commande', 'bons_commande_client_id_statut_index')) {
                $table->index(['client_id', 'statut'], 'bons_commande_client_id_statut_index');
            }
            if (! $this->hasIndex('bons_commande', 'bons_commande_dossier_id_statut_index')) {
                $table->index(['dossier_id', 'statut'], 'bons_commande_dossier_id_statut_index');
            }
            if (! $this->hasIndex('bons_commande', 'bons_commande_date_commande_index')) {
                $table->index('date_commande', 'bons_commande_date_commande_index');
            }
        });

        // ── dossiers ──────────────────────────────────────────────────────────
        // statut seul + composite client+statut
        Schema::table('dossiers', function (Blueprint $table) {
            if (! $this->hasIndex('dossiers', 'dossiers_statut_index')) {
                $table->index('statut', 'dossiers_statut_index');
            }
            if (! $this->hasIndex('dossiers', 'dossiers_client_id_statut_index')) {
                $table->index(['client_id', 'statut'], 'dossiers_client_id_statut_index');
            }
        });

        // ── samples ───────────────────────────────────────────────────────────
        // composites dossier+status, bc_ligne+status + dates de réception/prélèvement
        Schema::table('samples', function (Blueprint $table) {
            if (! $this->hasIndex('samples', 'samples_dossier_id_status_index')) {
                $table->index(['dossier_id', 'status'], 'samples_dossier_id_status_index');
            }
            if (! $this->hasIndex('samples', 'samples_bon_commande_ligne_id_status_index')) {
                $table->index(['bon_commande_ligne_id', 'status'], 'samples_bon_commande_ligne_id_status_index');
            }
            if (! $this->hasIndex('samples', 'samples_received_at_index')) {
                $table->index('received_at', 'samples_received_at_index');
            }
            if (! $this->hasIndex('samples', 'samples_collected_at_index')) {
                $table->index('collected_at', 'samples_collected_at_index');
            }
        });

        // ── mission_tasks ─────────────────────────────────────────────────────
        // statut seul (liste tâches labo/terrain sans filtre ligne) + dates planification
        Schema::table('mission_tasks', function (Blueprint $table) {
            if (! $this->hasIndex('mission_tasks', 'mission_tasks_statut_index')) {
                $table->index('statut', 'mission_tasks_statut_index');
            }
            if (! $this->hasIndex('mission_tasks', 'mission_tasks_planned_date_index')) {
                $table->index('planned_date', 'mission_tasks_planned_date_index');
            }
            if (! $this->hasIndex('mission_tasks', 'mission_tasks_due_date_index') && Schema::hasColumn('mission_tasks', 'due_date')) {
                $table->index('due_date', 'mission_tasks_due_date_index');
            }
        });

        // ── ordres_mission ────────────────────────────────────────────────────
        // composite dossier+statut (chaînes whereHas depuis MissionTaskController)
        Schema::table('ordres_mission', function (Blueprint $table) {
            if (! $this->hasIndex('ordres_mission', 'ordres_mission_dossier_id_statut_index')) {
                $table->index(['dossier_id', 'statut'], 'ordres_mission_dossier_id_statut_index');
            }
        });

        // ── rapport_bc_suivis ─────────────────────────────────────────────────
        // index explicite (FK auto uniquement jusqu'ici)
        if (Schema::hasTable('rapport_bc_suivis')) {
            Schema::table('rapport_bc_suivis', function (Blueprint $table) {
                if (! $this->hasIndex('rapport_bc_suivis', 'rapport_bc_suivis_rapport_bc_id_index')) {
                    $table->index('rapport_bc_id', 'rapport_bc_suivis_rapport_bc_id_index');
                }
            });
        }
    }

    public function down(): void
    {
        $drops = [
            'rapport_bcs'        => ['rapport_bcs_statut_index', 'rapport_bcs_bon_commande_id_statut_index', 'rapport_bcs_created_at_index'],
            'bons_commande'      => ['bons_commande_statut_index', 'bons_commande_client_id_statut_index', 'bons_commande_dossier_id_statut_index', 'bons_commande_date_commande_index'],
            'dossiers'           => ['dossiers_statut_index', 'dossiers_client_id_statut_index'],
            'samples'            => ['samples_dossier_id_status_index', 'samples_bon_commande_ligne_id_status_index', 'samples_received_at_index', 'samples_collected_at_index'],
            'mission_tasks'      => ['mission_tasks_statut_index', 'mission_tasks_planned_date_index', 'mission_tasks_due_date_index'],
            'ordres_mission'     => ['ordres_mission_dossier_id_statut_index'],
            'rapport_bc_suivis'  => ['rapport_bc_suivis_rapport_bc_id_index'],
        ];

        foreach ($drops as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) use ($indexes) {
                foreach ($indexes as $idx) {
                    if ($this->hasIndex($t->getTable(), $idx)) {
                        $t->dropIndex($idx);
                    }
                }
            });
        }
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $driver = DB::getDriverName();
        if ($driver === 'sqlite') {
            $indexes = DB::select("PRAGMA index_list(\"{$table}\")");
            foreach ($indexes as $idx) {
                if ($idx->name === $indexName) {
                    return true;
                }
            }
            return false;
        }
        $indexes = DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);
        return count($indexes) > 0;
    }
};
