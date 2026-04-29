<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MissionTask;
use App\Models\OrdreMissionLigne;
use App\Models\TaskMeasure;
use App\Models\TaskResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MissionTaskController extends Controller
{
    /**
     * GET /mission-tasks
     * Paramètres : assigned_user_id, statut, type (labo|technicien|ingenieur),
     *              date_from, date_to, ordre_mission_id, dossier_id
     */
    public function index(Request $request): JsonResponse
    {
        $q = MissionTask::query()
            ->with([
                'assignedUser:id,name,email',
                'ordreMissionLigne.ordreMission:id,numero,type,client_id',
                'ordreMissionLigne.ordreMission.client:id,name',
                'ordreMissionLigne.article:id,code,libelle',
                'ordreMissionLigne.articleAction:id,type,libelle,duree_heures',
                'ordreMissionLigne.articleAction.measureConfigs',
                'result',
                'measures.measureConfig',
            ]);

        if ($uid = $request->integer('assigned_user_id')) {
            $q->where('assigned_user_id', $uid);
        }
        if ($statut = $request->string('statut')) {
            $q->where('statut', $statut);
        }
        if ($type = $request->string('type')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('type', $type));
        }
        if ($omId = $request->integer('ordre_mission_id')) {
            $q->whereHas('ordreMissionLigne', fn ($sq) => $sq->where('ordre_mission_id', $omId));
        }
        if ($dossierId = $request->integer('dossier_id')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('dossier_id', $dossierId));
        }
        if ($from = $request->string('date_from')) {
            $q->where(fn ($sq) => $sq->whereDate('planned_date', '>=', $from)->orWhereDate('due_date', '>=', $from));
        }
        if ($to = $request->string('date_to')) {
            $q->where(fn ($sq) => $sq->whereDate('planned_date', '<=', $to)->orWhereDate('due_date', '<=', $to));
        }

        return response()->json($q->latest()->get());
    }

    /** GET /mission-tasks/{task} */
    public function show(int $id): JsonResponse
    {
        $task = MissionTask::with([
            'assignedUser:id,name,email',
            'validatedBy:id,name',
            'ordreMissionLigne.ordreMission.client:id,name',
            'ordreMissionLigne.article:id,code,libelle',
            'ordreMissionLigne.articleAction.measureConfigs',
            'measures.measureConfig',
            'measures.createdBy:id,name',
            'result.validatedBy:id,name',
        ])->findOrFail($id);

        return response()->json($task);
    }

    /** PUT /mission-tasks/{task} */
    public function update(Request $request, int $id): JsonResponse
    {
        $task = MissionTask::findOrFail($id);

        $data = $request->validate([
            'assigned_user_id' => 'nullable|exists:users,id',
            'statut'           => 'in:todo,in_progress,done,validated,rejected',
            'planned_date'     => 'nullable|date',
            'due_date'         => 'nullable|date',
            'notes'            => 'nullable|string',
            'started_at'       => 'nullable|date',
            'completed_at'     => 'nullable|date',
        ]);

        // Auto-timestamps sur changements de statut
        if (isset($data['statut'])) {
            if ($data['statut'] === MissionTask::STATUT_IN_PROGRESS && !$task->started_at) {
                $data['started_at'] = now();
            }
            if ($data['statut'] === MissionTask::STATUT_DONE && !$task->completed_at) {
                $data['completed_at'] = now();
            }
        }

        $task->update($data);
        return response()->json($task->fresh(['assignedUser:id,name', 'measures.measureConfig', 'result']));
    }

    /** POST /mission-tasks/{task}/measures — soumettre / mettre à jour des mesures */
    public function storeMeasures(Request $request, int $id): JsonResponse
    {
        $task = MissionTask::findOrFail($id);

        $validated = $request->validate([
            'measures'                        => 'required|array',
            'measures.*.measure_config_id'    => 'required|exists:action_measure_configs,id',
            'measures.*.value'                => 'nullable|string',
            'measures.*.value_numeric'        => 'nullable|numeric',
            'measures.*.attachment_path'      => 'nullable|string|max:512',
        ]);

        DB::transaction(function () use ($task, $validated, $request) {
            foreach ($validated['measures'] as $m) {
                TaskMeasure::updateOrCreate(
                    [
                        'mission_task_id' => $task->id,
                        'measure_config_id' => $m['measure_config_id'],
                    ],
                    [
                        'value'           => $m['value'] ?? null,
                        'value_numeric'   => $m['value_numeric'] ?? null,
                        'attachment_path' => $m['attachment_path'] ?? null,
                        'created_by'      => $request->user()?->id,
                    ]
                );
            }
        });

        $task->recomputeConformity();
        return response()->json($task->fresh(['measures.measureConfig', 'result']));
    }

    /** POST /mission-tasks/{task}/validate — valider le résultat */
    public function validate(Request $request, int $id): JsonResponse
    {
        $task = MissionTask::findOrFail($id);

        $data = $request->validate([
            'is_conform'   => 'required|boolean',
            'value_final'  => 'nullable|numeric',
            'conclusion'   => 'nullable|string|max:512',
            'observations' => 'nullable|string',
            'rapport_path' => 'nullable|string|max:512',
        ]);

        DB::transaction(function () use ($task, $data, $request) {
            TaskResult::updateOrCreate(
                ['mission_task_id' => $task->id],
                array_merge($data, [
                    'validated_by' => $request->user()?->id,
                    'validated_at' => now(),
                ])
            );

            $task->update([
                'statut'       => MissionTask::STATUT_VALIDATED,
                'validated_at' => now(),
                'validated_by' => $request->user()?->id,
                'is_conform'   => $data['is_conform'],
            ]);
        });

        return response()->json($task->fresh(['result', 'measures.measureConfig']));
    }

    /**
     * GET /mission-tasks/labo — tâches labo avec leurs formulaires (vue laborantin)
     */
    public function laboBoard(Request $request): JsonResponse
    {
        $q = MissionTask::query()
            ->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('type', 'labo'))
            ->with([
                'assignedUser:id,name',
                'ordreMissionLigne.ordreMission:id,numero,type,statut,client_id,dossier_id',
                'ordreMissionLigne.ordreMission.client:id,name',
                'ordreMissionLigne.ordreMission.dossier:id,reference,titre',
                'ordreMissionLigne.article:id,code,libelle',
                'ordreMissionLigne.articleAction:id,type,libelle,duree_heures',
                'ordreMissionLigne.articleAction.measureConfigs',
                'measures.measureConfig',
                'result',
            ]);

        if ($uid = $request->integer('user_id')) {
            $q->where('assigned_user_id', $uid);
        }
        if ($statut = $request->string('statut')) {
            $q->where('statut', $statut);
        }

        return response()->json($q->orderBy('due_date')->get());
    }

    /**
     * GET /mission-tasks/terrain — tâches terrain (vue technicien/ingénieur)
     */
    public function terrainBoard(Request $request): JsonResponse
    {
        $q = MissionTask::query()
            ->whereHas('ordreMissionLigne.ordreMission', function ($sq) {
                $sq->whereIn('type', ['technicien', 'ingenieur']);
            })
            ->with([
                'assignedUser:id,name',
                'ordreMissionLigne.ordreMission:id,numero,type,statut,client_id,site_id',
                'ordreMissionLigne.ordreMission.client:id,name',
                'ordreMissionLigne.ordreMission.site:id,name',
                'ordreMissionLigne.article:id,code,libelle',
                'ordreMissionLigne.articleAction:id,type,libelle,duree_heures',
                'ordreMissionLigne.articleAction.measureConfigs',
                'measures.measureConfig',
                'result',
            ]);

        if ($uid = $request->integer('user_id')) {
            $q->where('assigned_user_id', $uid);
        }
        if ($type = $request->string('type')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('type', $type));
        }
        if ($statut = $request->string('statut')) {
            $q->where('statut', $statut);
        }

        return response()->json($q->orderBy('planned_date')->get());
    }
}
