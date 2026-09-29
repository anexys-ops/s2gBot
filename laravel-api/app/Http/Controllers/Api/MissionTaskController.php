<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonCommandeLigne;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\OrderItem;
use App\Models\Sample;
use App\Models\Sequence;
use App\Models\TaskMeasure;
use App\Models\TaskResult;
use App\Services\TaskFormAssignmentService;
use App\Services\MissionTaskStatusService;
use App\Services\DevisJalonResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class MissionTaskController extends Controller
{
    public function __construct(
        private readonly TaskFormAssignmentService $formAssignments,
        private readonly MissionTaskStatusService $statusSync,
        private readonly DevisJalonResolver $jalonResolver,
    ) {}

    /** Ajoute N jours ouvrés (saute samedi/dimanche) à une date. */
    private function addBusinessDays(\Carbon\Carbon $date, int $days): \Carbon\Carbon
    {
        $result = $date->copy();
        while ($days > 0) {
            $result->addDay();
            if (! $result->isWeekend()) {
                $days--;
            }
        }

        return $result;
    }

    /**
     * BonCommandeLigne ids partageant le jalon devis de la ligne d'OM de $task
     * (ou toutes les lignes du BC si $force).
     *
     * @return list<int>
     */
    private function siblingBonCommandeLigneIds(MissionTask $task, bool $force): array
    {
        $ligne = $task->ordreMissionLigne()->with('ordreMission.bonCommande')->first();
        $bc = $ligne?->ordreMission?->bonCommande;
        if (! $ligne || ! $bc) {
            return [];
        }

        $bcLigne = BonCommandeLigne::query()->find($ligne->bon_commande_ligne_id);
        if ($force || ! $bcLigne?->ref_article_id) {
            return BonCommandeLigne::query()->where('bon_commande_id', $bc->id)->pluck('id')->all();
        }

        $refIds = $this->jalonResolver->siblingRefArticleIds($bc, (int) $bcLigne->ref_article_id);
        if ($refIds === null) {
            // Pas de structure de jalons sur ce BC : impossible de restreindre sans risquer
            // d'exclure à tort les FOLD terrain (article différent) — on élargit à tout le BC.
            return BonCommandeLigne::query()->where('bon_commande_id', $bc->id)->pluck('id')->all();
        }

        return BonCommandeLigne::query()
            ->where('bon_commande_id', $bc->id)
            ->whereIn('ref_article_id', $refIds)
            ->pluck('id')
            ->all();
    }

    private const SAMPLE_USABLE_STATUSES = [
        Sample::STATUS_RECEPTIONNE,
        Sample::STATUS_IMPRIME,
        Sample::STATUS_EN_ESSAI,
        Sample::STATUS_TERMINE,
        Sample::STATUS_STOCKE,
        Sample::STATUS_ARCHIVE,
    ];

    /** Liste les FOLD disponibles pour rattacher à une tâche labo. */
    public function availableSamples(Request $request, int $id): JsonResponse
    {
        $task = MissionTask::findOrFail($id);
        $force = $request->boolean('force');

        $ligneIds = $this->siblingBonCommandeLigneIds($task, $force);
        if ($ligneIds === []) {
            return response()->json([]);
        }

        $terrainTaskIds = MissionTask::query()
            ->whereHas('ordreMissionLigne', fn ($q) => $q->whereIn('bon_commande_ligne_id', $ligneIds))
            ->pluck('id');

        $samples = Sample::query()
            ->whereIn('task_id', $terrainTaskIds)
            ->whereIn('status', self::SAMPLE_USABLE_STATUSES)
            ->with(['labTasks:id,unique_number'])
            ->orderBy('fold_number')
            ->get(['id', 'fold_number', 'transco_number', 'description', 'sample_type', 'received_at', 'task_id', 'bon_commande_ligne_id']);

        return response()->json($samples);
    }

    /** Rattache un ou plusieurs FOLD (samples) à une tâche labo. */
    public function attachSamples(Request $request, int $id): JsonResponse
    {
        $task = MissionTask::findOrFail($id);
        $data = $request->validate([
            'sample_ids' => 'required|array|min:1',
            'sample_ids.*' => 'integer|exists:samples,id',
            'forced' => 'sometimes|boolean',
        ]);
        $forced = (bool) ($data['forced'] ?? false);

        if (! $forced) {
            $allowedLigneIds = $this->siblingBonCommandeLigneIds($task, false);
            $allowedTerrainTaskIds = MissionTask::query()
                ->whereHas('ordreMissionLigne', fn ($q) => $q->whereIn('bon_commande_ligne_id', $allowedLigneIds))
                ->pluck('id');
            $invalid = Sample::query()
                ->whereIn('id', $data['sample_ids'])
                ->whereNotIn('task_id', $allowedTerrainTaskIds)
                ->exists();
            if ($invalid) {
                return response()->json([
                    'message' => 'Un des FOLD sélectionnés n\'appartient pas au même jalon. Cochez "Forcer" pour l\'autoriser quand même.',
                ], 422);
            }
        }

        foreach ($data['sample_ids'] as $sampleId) {
            $task->samples()->syncWithoutDetaching([$sampleId => ['forced' => $forced]]);
        }

        // Première planification automatique : lendemain ouvré de la réception la plus tardive,
        // uniquement si aucune date n'a déjà été fixée (manuellement ou par un attachement précédent).
        if (! $task->planned_date) {
            $lastReceivedAt = $task->samples()->max('received_at');
            if ($lastReceivedAt) {
                $task->update(['planned_date' => $this->addBusinessDays(\Carbon\Carbon::parse($lastReceivedAt), 1)]);
            }
        }

        return response()->json($task->fresh(['samples', 'assignedUser:id,name']));
    }

    /** Détache un FOLD d'une tâche labo. */
    public function detachSample(Request $request, int $id, int $sampleId): JsonResponse
    {
        $task = MissionTask::findOrFail($id);
        $task->samples()->detach($sampleId);

        return response()->json($task->fresh(['samples', 'assignedUser:id,name']));
    }

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
                'ordreMissionLigne.article:id,code,libelle,unite',
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
            'ordreMissionLigne.article:id,code,libelle,unite',
            'ordreMissionLigne.articleAction.measureConfigs',
            'measures.measureConfig',
            'measures.createdBy:id,name',
            'result.validatedBy:id,name',
            'testForms.testType:id,name,norm',
            'testForms.photos',
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
            'no_fold_required' => 'sometimes|boolean',
        ]);

        if (($data['statut'] ?? null) === MissionTask::STATUT_VALIDATED && $this->formAssignments->hasPendingForms($task)) {
            throw ValidationException::withMessages(['statut' => 'Les formulaires affectés à cette tâche doivent être validés avant sa clôture.']);
        }

        if (isset($data['statut']) && $data['statut'] !== MissionTask::STATUT_TODO) {
            $noFoldRequired = $data['no_fold_required'] ?? $task->no_fold_required;
            $om = $task->ordreMissionLigne()->with('ordreMission')->first()?->ordreMission;
            if ($om?->type === OrdreMission::TYPE_LABO && ! $noFoldRequired && $task->samples()->count() === 0) {
                throw ValidationException::withMessages([
                    'statut' => 'Rattachez au moins un FOLD à cette tâche (ou cochez "pas de FOLD nécessaire") avant de l\'avancer.',
                ]);
            }
        }

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
        $this->statusSync->syncOrdreMissionFromTask($task);

        return response()->json($task->fresh(['assignedUser:id,name', 'measures.measureConfig', 'result']));
    }

    /** Clôture une tâche et prépare ses étiquettes dans la réception laboratoire. */
    public function closeReception(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'pv_numbers' => 'required|array|min:1',
            'pv_numbers.*' => 'required|string|max:100|distinct',
            'quantity_unit' => 'required|string|max:24',
            'quantity_count' => 'required|integer|min:1',
        ]);

        $result = DB::transaction(function () use ($id, $data) {
            $task = MissionTask::query()->lockForUpdate()->with([
                'ordreMissionLigne.ordreMission',
                'ordreMissionLigne.bonCommandeLigne',
            ])->findOrFail($id);
            $ligne = $task->ordreMissionLigne;
            $source = $ligne?->bonCommandeLigne;
            $ordreMission = $ligne?->ordreMission;

            if (! $source || ! $ordreMission) {
                throw ValidationException::withMessages([
                    'quantity_count' => "Cette tâche n'est pas reliée à une ligne de bon de commande.",
                ]);
            }

            if ($ordreMission->type !== OrdreMission::TYPE_TECHNICIEN) {
                throw ValidationException::withMessages([
                    'quantity_count' => "Seule une tâche de prélèvement terrain peut générer des échantillons de réception. Rattachez plutôt le FOLD existant à cette tâche.",
                ]);
            }

            $existing = Sample::query()->where('task_id', $task->id)->count();
            $remaining = $this->remainingQuantity($source);
            if ($existing === 0 && (int) $data['quantity_count'] > $remaining) {
                throw ValidationException::withMessages([
                    'quantity_count' => "La quantité dépasse le reliquat du bon de commande ({$remaining}).",
                ]);
            }

            $task->update([
                'pv_numbers' => array_values($data['pv_numbers']),
                'quantity_unit' => $data['quantity_unit'],
                'quantity_count' => (int) $data['quantity_count'],
                'statut' => $task->statut === MissionTask::STATUT_VALIDATED
                    ? MissionTask::STATUT_VALIDATED
                    : MissionTask::STATUT_DONE,
                'completed_at' => $task->completed_at ?? now(),
                'reception_generated_at' => $task->reception_generated_at ?? now(),
            ]);
            $this->statusSync->syncOrdreMissionFromTask($task);

            $created = 0;
            if ($existing === 0) {
                $pv = implode(', ', $data['pv_numbers']);
                for ($index = 1; $index <= (int) $data['quantity_count']; $index++) {
                    $sampleData = [
                        'reference' => Sequence::next('ECH'),
                        'reception_index' => $index,
                        'reception_batch_total' => (int) $data['quantity_count'],
                        'dossier_id' => $ordreMission->dossier_id,
                        'mission_order_id' => $ordreMission->id,
                        'task_id' => $task->id,
                        'prepared_by_task_at' => now(),
                        'product_id' => $source->ref_article_id,
                        'bon_commande_ligne_id' => $source->id,
                        'description' => $source->libelle,
                        'sample_type' => 'autre',
                        'collected_by' => $task->assigned_user_id,
                        'collected_at' => now(),
                        'status' => Sample::STATUS_EN_TRANSIT,
                        'quantity' => 1,
                        'notes' => "PV : {$pv} · Unité : {$data['quantity_unit']}",
                    ];
                    if (Schema::getConnection()->getDriverName() === 'sqlite') {
                        $sampleData['order_item_id'] = OrderItem::query()->value('id');
                    }
                    Sample::query()->create($sampleData);
                    $created++;
                }
            }

            return [
                'task' => $task->fresh(['assignedUser:id,name', 'ordreMissionLigne.ordreMission']),
                'samples_created' => $created,
                'remaining_quantity' => $this->remainingQuantity($source),
            ];
        });

        return response()->json($result);
    }

    /** Ajoute une nouvelle tâche sur la même ligne BC tant qu'un reliquat subsiste. */
    public function duplicate(int $id): JsonResponse
    {
        $task = MissionTask::query()->with('ordreMissionLigne.bonCommandeLigne')->findOrFail($id);
        $ligne = $task->ordreMissionLigne;
        $source = $ligne?->bonCommandeLigne;
        $remaining = $source ? $this->remainingQuantity($source) : 0;

        if (! $source || $remaining < 1) {
            throw ValidationException::withMessages(['task' => 'Aucun reliquat disponible pour une nouvelle tâche.']);
        }

        $newTask = DB::transaction(function () use ($ligne, $remaining) {
            $copy = $ligne->replicate(['date_realisation', 'duree_reelle_heures', 'notes']);
            $copy->statut = 'planifie';
            $copy->quantite = $remaining;
            $copy->assigned_user_id = null;
            $copy->equipment_id = null;
            $copy->date_prevue = null;
            $copy->ordre = ((int) $ligne->ordreMission->lignes()->max('ordre')) + 1;
            $copy->save();

            return $copy->ensureTaskExists();
        });

        return response()->json($newTask->fresh(['ordreMissionLigne.ordreMission']), 201);
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
        if ($this->formAssignments->hasPendingForms($task)) {
            throw ValidationException::withMessages(['task' => 'Les formulaires affectés à cette tâche doivent être validés avant sa clôture.']);
        }

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

            $this->statusSync->syncOrdreMissionFromTask($task);
        });

        return response()->json($task->fresh(['result', 'measures.measureConfig']));
    }

    /** DELETE /mission-tasks/{task} */
    public function destroy(int $id): JsonResponse
    {
        $task = MissionTask::findOrFail($id);
        $task->delete();

        return response()->json(null, 204);
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
                'ordreMissionLigne.ordreMission:id,numero,type,statut,client_id,site_id,dossier_id',
                'ordreMissionLigne.ordreMission.client:id,name',
                'ordreMissionLigne.ordreMission.site:id,name',
                'ordreMissionLigne.ordreMission.dossier:id,reference,titre',
                'ordreMissionLigne.ordreMission.bonCommande:id,numero,quote_id,dossier_id',
                'ordreMissionLigne.ordreMission.bonCommande.quote:id,meta',
                'ordreMissionLigne.ordreMission.bonCommande.lignes:id,bon_commande_id,ref_article_id,libelle,quantite,ordre',
                'ordreMissionLigne.article:id,code,libelle,unite',
                'ordreMissionLigne.articleAction:id,type,libelle,duree_heures',
                'ordreMissionLigne.articleAction.measureConfigs',
                'measures.measureConfig',
                'result',
                'samples:id,fold_number',
            ]);

        if ($uid = $request->integer('user_id')) {
            $q->where('assigned_user_id', $uid);
        }
        if ($statut = $this->optionalQueryString($request, 'statut')) {
            $q->where('statut', $statut);
        }

        return response()->json($this->withJalonContext($q->orderBy('due_date')->get()));
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
                'ordreMissionLigne.ordreMission.bonCommande:id,numero,quote_id,dossier_id',
                'ordreMissionLigne.ordreMission.bonCommande.dossier:id,reference,titre',
                'ordreMissionLigne.ordreMission.bonCommande.quote:id,meta',
                'ordreMissionLigne.ordreMission.bonCommande.lignes:id,bon_commande_id,ref_article_id,libelle,quantite,ordre',
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
        if ($request->boolean('active_only')) {
            $q->whereHas('ordreMissionLigne.ordreMission', fn ($sq) => $sq->whereIn('statut', [
                OrdreMission::STATUT_PLANIFIE,
                OrdreMission::STATUT_EN_COURS,
            ]))->whereNotIn('statut', [
                MissionTask::STATUT_DONE,
                MissionTask::STATUT_VALIDATED,
                MissionTask::STATUT_REJECTED,
            ]);
        }

        return response()->json($this->withJalonContext($q->orderBy('planned_date')->get()));
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
            ->where(function ($query) {
                // Un dossier apparaît ici s'il a des mesures géotechniques à saisir OU des
                // formulaires d'essai assignés à son produit — qu'ils aient déjà été
                // commencés (ligne testForms) ou non (ligne article.testTypes), pour ne
                // pas masquer les tâches dont aucun formulaire n'a encore été ouvert.
                $query->whereHas('ordreMissionLigne.articleAction.measureConfigs')
                    ->orWhereHas('testForms')
                    ->orWhereHas('ordreMissionLigne.article.testTypes', function ($tq) {
                        $tq->where(fn ($ctx) => $ctx->whereNull('test_types.context')->orWhereIn('test_types.context', ['terrain', 'ingenieur']));
                    });
            })
            ->withCount('testForms')
            ->with([
                'assignedUser:id,name',
                'ordreMissionLigne:id,ordre_mission_id,libelle,ref_article_id,article_action_id,statut',
                'ordreMissionLigne.ordreMission:id,numero,type,statut,client_id,site_id,dossier_id',
                'ordreMissionLigne.ordreMission.client:id,name',
                'ordreMissionLigne.ordreMission.site:id,name',
                'ordreMissionLigne.ordreMission.dossier:id,reference,titre,date_debut,date_fin_prevue',
                'ordreMissionLigne.article:id,code,libelle,unite',
                'ordreMissionLigne.article.testTypes:id,name,context',
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

        $tasks = $q->orderBy('planned_date')->get();

        // Nombre de types d'essai réellement assignables au produit/action de la
        // ligne (contexte terrain/ingénieur), qu'un TaskTestForm existe déjà ou non
        // — permet au front d'afficher "3 formulaire(s) d'essai" même si aucun
        // n'a encore été ouvert depuis l'application mobile.
        $tasks->each(function (MissionTask $task) {
            $line = $task->ordreMissionLigne;
            $context = match ($line?->ordreMission?->type) {
                'technicien' => 'terrain',
                'ingenieur' => 'ingenieur',
                default => null,
            };
            $available = $line?->article?->testTypes->filter(function ($type) use ($line, $context) {
                $actionMatches = $type->pivot->article_action_id === null || $type->pivot->article_action_id === $line->article_action_id;
                $contextMatches = $type->context === null || $type->context === $context;

                return $actionMatches && $contextMatches;
            }) ?? collect();
            $task->setAttribute('test_forms_available_count', $available->count());
        });

        return response()->json($tasks);
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

    private function withJalonContext($tasks)
    {
        foreach ($tasks as $task) {
            $ligne = $task->ordreMissionLigne;
            $bonCommande = $ligne?->ordreMission?->bonCommande;
            $source = $bonCommande?->lignes?->firstWhere('id', (int) $ligne?->bon_commande_ligne_id);
            $meta = $bonCommande?->quote?->meta;
            $context = null;

            if ($source && is_array($meta)) {
                foreach (($meta['devis_jalons'] ?? []) as $jalon) {
                    $label = trim((string) ($jalon['libelle'] ?? ''));
                    $productIds = array_map('intval', $jalon['product_ref_article_ids'] ?? []);
                    $matchesProduct = $source->ref_article_id && in_array((int) $source->ref_article_id, $productIds, true);
                    $matchesForfait = $label !== '' && $source->libelle === 'Prestation forfaitaire — '.$label;
                    if (! $matchesProduct && ! $matchesForfait) {
                        continue;
                    }

                    $context = [
                        'id' => (string) ($jalon['id'] ?? ''),
                        'label' => $label,
                        'code' => $jalon['s2g_code'] ?? null,
                    ];
                    break;
                }
            }

            $task->setAttribute('jalon_context', $context);
            if ($source) {
                $remaining = $this->remainingQuantity($source);
                $task->setAttribute('ordered_quantity', (int) floor((float) $source->quantite));
                $task->setAttribute('remaining_quantity', $remaining);
                $task->setAttribute('received_quantity', max(0, (int) floor((float) $source->quantite) - $remaining));
            }
        }

        return $tasks;
    }

    private function remainingQuantity(BonCommandeLigne $ligne): int
    {
        $received = Sample::query()
            ->where('bon_commande_ligne_id', $ligne->id)
            ->whereNotIn('status', [Sample::STATUS_ANNULE, Sample::STATUS_REJETE])
            ->count();

        return max(0, (int) floor((float) $ligne->quantite) - $received);
    }
}
