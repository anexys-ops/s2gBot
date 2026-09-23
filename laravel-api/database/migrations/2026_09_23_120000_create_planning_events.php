<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('planning_events', function (Blueprint $table) {
            $table->id();
            $table->string('source_type', 32);
            $table->unsignedBigInteger('source_id');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('equipment_id')->nullable()->constrained('equipments')->nullOnDelete();
            $table->foreignId('mission_task_id')->nullable()->constrained('mission_tasks')->nullOnDelete();
            $table->foreignId('bon_commande_ligne_id')->nullable()->constrained('bons_commande_lignes')->nullOnDelete();
            $table->foreignId('dossier_id')->nullable()->constrained('dossiers')->nullOnDelete();
            $table->unsignedBigInteger('ordre_mission_id')->nullable();
            $table->date('date_debut');
            $table->date('date_fin');
            $table->time('heure_debut')->nullable();
            $table->time('heure_fin')->nullable();
            $table->string('type_evenement', 64);
            $table->boolean('is_validated')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['source_type', 'source_id']);
            $table->index(['date_debut', 'date_fin']);
            $table->index(['user_id', 'date_debut']);
            $table->index(['equipment_id', 'date_debut']);
            $table->index('mission_task_id');
        });

        // Older OM tasks could have an assignee and date without a planning slot.
        DB::table('mission_tasks as task')
            ->leftJoin('planning_humans as slot', 'slot.mission_task_id', '=', 'task.id')
            ->leftJoin('ordre_mission_lignes as line', 'line.id', '=', 'task.ordre_mission_ligne_id')
            ->whereNull('task.deleted_at')
            ->whereNull('slot.id')
            ->whereNotNull('task.assigned_user_id')
            ->whereNotNull('task.planned_date')
            ->select('task.id as task_id', 'task.assigned_user_id', 'task.planned_date', 'task.due_date', 'line.libelle')
            ->orderBy('task.id')
            ->chunkById(500, function ($rows) {
                $now = now();
                DB::table('planning_humans')->insert($rows->map(fn ($task) => [
                    'mission_task_id' => $task->task_id,
                    'user_id' => $task->assigned_user_id,
                    'date_debut' => substr($task->planned_date, 0, 10),
                    'date_fin' => substr($task->due_date ?? $task->planned_date, 0, 10),
                    'type_evenement' => 'tache',
                    'notes' => $task->libelle,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            }, 'task.id', 'task_id');

        DB::table('mission_tasks as task')
            ->join('ordre_mission_lignes as line', 'line.id', '=', 'task.ordre_mission_ligne_id')
            ->leftJoin('planning_equipments as slot', 'slot.mission_task_id', '=', 'task.id')
            ->whereNull('task.deleted_at')
            ->whereNull('slot.id')
            ->whereNotNull('line.equipment_id')
            ->whereNotNull('task.planned_date')
            ->select('task.id as task_id', 'task.assigned_user_id', 'task.planned_date', 'task.due_date', 'line.equipment_id', 'line.libelle')
            ->orderBy('task.id')
            ->chunkById(500, function ($rows) {
                $now = now();
                DB::table('planning_equipments')->insert($rows->map(fn ($task) => [
                    'mission_task_id' => $task->task_id,
                    'equipment_id' => $task->equipment_id,
                    'user_id' => $task->assigned_user_id,
                    'date_debut' => substr($task->planned_date, 0, 10),
                    'date_fin' => substr($task->due_date ?? $task->planned_date, 0, 10),
                    'type_evenement' => 'utilisation',
                    'notes' => $task->libelle,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            }, 'task.id', 'task_id');

        foreach ([
            'planning_humans' => 'human',
            'planning_equipments' => 'equipment',
            'stock_personnels' => 'stock_personnel',
            'stock_equipments' => 'stock_equipment',
            'bc_ligne_planning_affectations' => 'terrain_bc',
        ] as $table => $sourceType) {
            DB::table($table)->orderBy('id')->chunkById(500, function ($rows) use ($sourceType) {
                $events = [];
                foreach ($rows as $row) {
                    $events[] = [
                        'source_type' => $sourceType,
                        'source_id' => $row->id,
                        'user_id' => $row->user_id ?? null,
                        'equipment_id' => $row->equipment_id ?? null,
                        'mission_task_id' => $row->mission_task_id ?? null,
                        'bon_commande_ligne_id' => $row->bon_commande_ligne_id ?? null,
                        'date_debut' => $row->date_debut,
                        'date_fin' => $row->date_fin,
                        'heure_debut' => $row->heure_debut ?? null,
                        'heure_fin' => $row->heure_fin ?? null,
                        'type_evenement' => $row->type_evenement ?? $row->motif ?? ($sourceType === 'terrain_bc' ? 'terrain_bc' : 'autre'),
                        'is_validated' => $row->is_validated ?? null,
                        'notes' => $row->notes ?? null,
                        'created_at' => $row->created_at,
                        'updated_at' => $row->updated_at,
                    ];
                }
                DB::table('planning_events')->insert($events);
            });
        }

        DB::table('materiel_affectations')->orderBy('id')->chunkById(500, function ($rows) {
            DB::table('planning_events')->insert($rows->map(fn ($row) => [
                'source_type' => 'materiel_affectation',
                'source_id' => $row->id,
                'user_id' => $row->user_id,
                'equipment_id' => $row->equipment_id,
                'dossier_id' => $row->dossier_id,
                'ordre_mission_id' => $row->ordre_mission_id,
                'date_debut' => $row->date_debut,
                'date_fin' => $row->date_retour_effective ?? $row->date_retour_prevue ?? $row->date_debut,
                'type_evenement' => 'utilisation_chantier',
                'notes' => $row->observations,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ])->all());
        });

        DB::table('equipment_maintenance_plans')->where('active', true)->whereNotNull('next_due_at')
            ->orderBy('id')->chunkById(500, function ($rows) {
                DB::table('planning_events')->insert($rows->map(fn ($row) => [
                    'source_type' => 'maintenance_plan',
                    'source_id' => $row->id,
                    'equipment_id' => $row->equipment_id,
                    'date_debut' => $row->next_due_at,
                    'date_fin' => $row->next_due_at,
                    'type_evenement' => $row->kind,
                    'notes' => $row->label,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ])->all());
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('planning_events');
    }
};
