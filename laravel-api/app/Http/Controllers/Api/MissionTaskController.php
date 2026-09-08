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
    private function optionalQueryString(Request $request, string $key): ?string
    {
        if (! $request->filled($key)) {
            return null;
        }

        $value = trim($request->string($key)->toString());

        return $value !== '' ? $value : null;
    }

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
        if ($statut = $this->optionalQueryString($request, 'statut')) {
            $q->where('statut', $statut);
        }
        if ($type = $this->optionalQueryString($request, 'type')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('type', $type));
        }
        if ($omId = $request->integer('ordre_mission_id')) {
            $q->whereHas('ordreMissionLigne', fn ($sq) => $sq->where('ordre_mission_id', $omId));
        }
        if ($dossierId = $request->integer('dossier_id')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('dossier_id', $dossierId));
        }
        if ($from = $this->optionalQueryString($request, 'date_from')) {
            $q->where(fn ($sq) => $sq->whereDate('planned_date', '>=', $from)->orWhereDate('due_date', '>=', $from));
        }
        if ($to = $this->optionalQueryString($request, 'date_to')) {
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
            'statut'           => 'in:'.implode(',', MissionTask::statuts()),
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
        OrdreMissionLigne::syncMissingMissionTasks(['labo']);

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
        if ($statut = $this->optionalQueryString($request, 'statut')) {
            $q->where('statut', $statut);
        }

        return response()->json($q->orderBy('due_date')->get());
    }

    /**
     * GET /mission-tasks/terrain — tâches terrain (vue technicien/ingénieur)
     */
    public function terrainBoard(Request $request): JsonResponse
    {
        OrdreMissionLigne::syncMissingMissionTasks(['technicien', 'ingenieur']);

        $q = MissionTask::query()
            ->whereHas('ordreMissionLigne.ordreMission', function ($sq) {
                $sq->whereIn('type', ['technicien', 'ingenieur']);
            })
            ->with([
                'assignedUser:id,name',
                'ordreMissionLigne',
                'ordreMissionLigne.ordreMission.client',
                'ordreMissionLigne.ordreMission.site',
                'ordreMissionLigne.ordreMission.dossier',
                'ordreMissionLigne.ordreMission.bonCommande:id,numero,dossier_id',
                'ordreMissionLigne.ordreMission.bonCommande.dossier:id,reference,titre',
                'ordreMissionLigne.article',
                'ordreMissionLigne.articleAction.measureConfigs',
                'measures.measureConfig',
                'result',
            ]);

        if ($uid = $request->integer('user_id')) {
            $q->where('assigned_user_id', $uid);
        }
        if ($type = $this->optionalQueryString($request, 'type')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('type', $type));
        }
        if ($statut = $this->optionalQueryString($request, 'statut')) {
            $q->where('statut', $statut);
        }

        return response()->json($q->orderBy('planned_date')->get());
    }

    /**
     * GET /mission-tasks/terrain/measures — tâches terrain avec formulaires de mesure
     *
     * Paramètres : user_id, type, statut, dossier_id, date_from, date_to, search
     */
    public function terrainMeasuresBoard(Request $request): JsonResponse
    {
        OrdreMissionLigne::syncMissingMissionTasks(['technicien', 'ingenieur']);

        $q = MissionTask::query()
            ->whereHas('ordreMissionLigne.ordreMission', function ($sq) {
                $sq->whereIn('type', ['technicien', 'ingenieur']);
            })
            ->whereHas('ordreMissionLigne.articleAction.measureConfigs')
            ->with([
                'assignedUser:id,name',
                'ordreMissionLigne:id,ordre_mission_id,libelle,ref_article_id,article_action_id,statut',
                'ordreMissionLigne.ordreMission:id,numero,type,statut,client_id,site_id,dossier_id',
                'ordreMissionLigne.ordreMission.client:id,name',
                'ordreMissionLigne.ordreMission.site:id,name',
                'ordreMissionLigne.ordreMission.dossier:id,reference,titre,date_debut,date_fin_prevue',
                'ordreMissionLigne.article:id,code,libelle',
                'ordreMissionLigne.articleAction:id,type,libelle,duree_heures',
                'ordreMissionLigne.articleAction.measureConfigs',
                'measures.measureConfig',
                'measures.createdBy:id,name',
                'result',
            ]);

        if ($uid = $request->integer('user_id')) {
            $q->where('assigned_user_id', $uid);
        }
        if ($type = $this->optionalQueryString($request, 'type')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('type', $type));
        }
        if ($statut = $this->optionalQueryString($request, 'statut')) {
            $q->where('statut', $statut);
        }
        if ($dossierId = $request->integer('dossier_id')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('dossier_id', $dossierId));
        }
        if ($from = $this->optionalQueryString($request, 'date_from')) {
            $q->where(fn ($sq) => $sq->whereDate('planned_date', '>=', $from)->orWhereDate('due_date', '>=', $from));
        }
        if ($to = $this->optionalQueryString($request, 'date_to')) {
            $q->where(fn ($sq) => $sq->whereDate('planned_date', '<=', $to)->orWhereDate('due_date', '<=', $to));
        }
        if ($search = $this->optionalQueryString($request, 'search')) {
            $term = '%'.addcslashes($search, '%_\\').'%';
            $q->where(function ($sq) use ($term) {
                $sq->where('unique_number', 'like', $term)
                    ->orWhereHas('ordreMissionLigne.ordreMission', fn ($om) => $om->where('numero', 'like', $term))
                    ->orWhereHas('ordreMissionLigne.ordreMission.dossier', fn ($d) => $d->where('reference', 'like', $term)->orWhere('titre', 'like', $term))
                    ->orWhereHas('ordreMissionLigne.ordreMission.client', fn ($c) => $c->where('name', 'like', $term))
                    ->orWhereHas('ordreMissionLigne.article', fn ($a) => $a->where('code', 'like', $term)->orWhere('libelle', 'like', $term))
                    ->orWhereHas('ordreMissionLigne.articleAction', fn ($a) => $a->where('libelle', 'like', $term));
            });
        }

        return response()->json($q->orderBy('planned_date')->get());
    }

    /**
     * GET /mission-tasks/terrain/history — vue synthétique des tâches terrain
     *
     * Paramètres : user_id, type, statut, dossier_id, date_from, date_to (sur date de fin),
     *              search (article, action, TSK, OdM, dossier), completed_only (1 = terminées uniquement)
     */
    public function terrainHistory(Request $request): JsonResponse
    {
        OrdreMissionLigne::syncMissingMissionTasks(['technicien', 'ingenieur']);

        $q = MissionTask::query()
            ->whereHas('ordreMissionLigne.ordreMission', function ($sq) {
                $sq->whereIn('type', ['technicien', 'ingenieur']);
            })
            ->with([
                'assignedUser:id,name',
                'validatedBy:id,name',
                'ordreMissionLigne',
                'ordreMissionLigne.ordreMission.client',
                'ordreMissionLigne.ordreMission.site',
                'ordreMissionLigne.ordreMission.dossier',
                'ordreMissionLigne.ordreMission.bonCommande:id,numero,dossier_id',
                'ordreMissionLigne.ordreMission.bonCommande.dossier:id,reference,titre',
                'ordreMissionLigne.article',
                'ordreMissionLigne.articleAction.measureConfigs',
                'measures.measureConfig',
                'measures.createdBy:id,name',
                'result.validatedBy:id,name',
            ]);

        if ($uid = $request->integer('user_id')) {
            $q->where('assigned_user_id', $uid);
        }
        if ($type = $this->optionalQueryString($request, 'type')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('type', $type));
        }
        if ($statut = $this->optionalQueryString($request, 'statut')) {
            $q->where('statut', $statut);
        } elseif ($request->boolean('completed_only')) {
            $q->whereIn('statut', [
                MissionTask::STATUT_DONE,
                MissionTask::STATUT_VALIDATED,
                MissionTask::STATUT_REJECTED,
            ]);
        }
        if ($dossierId = $request->integer('dossier_id')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->where('dossier_id', $dossierId));
        }
        if ($from = $this->optionalQueryString($request, 'date_from')) {
            $q->where(function ($sq) use ($from) {
                $sq->whereDate('completed_at', '>=', $from)
                    ->orWhere(function ($sq2) use ($from) {
                        $sq2->whereNull('completed_at')->whereDate('validated_at', '>=', $from);
                    })
                    ->orWhere(function ($sq2) use ($from) {
                        $sq2->whereNull('completed_at')->whereNull('validated_at')->whereDate('planned_date', '>=', $from);
                    });
            });
        }
        if ($to = $this->optionalQueryString($request, 'date_to')) {
            $q->where(function ($sq) use ($to) {
                $sq->whereDate('completed_at', '<=', $to)
                    ->orWhere(function ($sq2) use ($to) {
                        $sq2->whereNull('completed_at')->whereDate('validated_at', '<=', $to);
                    })
                    ->orWhere(function ($sq2) use ($to) {
                        $sq2->whereNull('completed_at')->whereNull('validated_at')->whereDate('planned_date', '<=', $to);
                    });
            });
        }
        if ($search = $this->optionalQueryString($request, 'search')) {
            $term = '%' . addcslashes($search, '%_\\') . '%';
            $q->where(function ($sq) use ($term) {
                $sq->where('unique_number', 'like', $term)
                    ->orWhereHas('ordreMissionLigne.ordreMission', fn ($om) => $om->where('numero', 'like', $term))
                    ->orWhereHas('ordreMissionLigne.ordreMission.dossier', fn ($d) => $d->where('reference', 'like', $term)->orWhere('titre', 'like', $term))
                    ->orWhereHas('ordreMissionLigne.article', fn ($a) => $a->where('code', 'like', $term)->orWhere('libelle', 'like', $term))
                    ->orWhereHas('ordreMissionLigne.articleAction', fn ($a) => $a->where('libelle', 'like', $term));
            });
        }

        return response()->json(
            $q->orderByDesc('completed_at')
                ->orderByDesc('validated_at')
                ->orderByDesc('planned_date')
                ->get()
        );
    }
}
