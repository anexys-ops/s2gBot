<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArticleAction;
use App\Models\BonCommande;
use App\Models\Catalogue\Article;
use App\Models\ExpenseLine;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\PlanningEquipment;
use App\Models\PlanningHuman;
use App\Services\ExpenseReportService;
use App\Services\OrdreMissionFromBonCommandeService;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrdreMissionController extends Controller
{
    private const WITH = [
        'client:id,name',
        'site:id,name',
        'dossier:id,reference,titre',
        'centreGroup:id,code,name',
        'responsable:id,name',
        'bonCommande:id,numero,quote_id,dossier_id',
        'bonCommande.quote:id,number',
        'bonCommande.dossier:id,reference,titre',
        'lignes.assignedUser:id,name',
        'lignes.equipment:id,name,code',
        'lignes.articleAction',
        'lignes.article:id,code,libelle',
        'lignes.bonCommandeLigne:id,libelle,quantite,ref_article_id,technicien_id,date_debut_prevue,date_fin_prevue',
    ];

    public function __construct(
        private readonly OrdreMissionFromBonCommandeService $generator,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = OrdreMission::with([
            'client:id,name',
            'responsable:id,name',
            'bonCommande:id,numero,quote_id',
            'bonCommande.quote:id,number',
        ]);

        if ($type = $request->query('type')) {
            $q->where('type', $type);
        }
        if ($statut = $request->query('statut')) {
            $q->where('statut', $statut);
        }
        if ($bcId = $request->query('bon_commande_id')) {
            $q->where('bon_commande_id', $bcId);
        }
        if ($from = $request->query('date_from')) {
            $q->where('date_prevue', '>=', $from);
        }
        if ($to = $request->query('date_to')) {
            $q->where('date_prevue', '<=', $to);
        }

        return response()->json(
            $q->orderByDesc('id')->get()
        );
    }

    public function show(OrdreMission $ordreMission): JsonResponse
    {
        if (in_array($ordreMission->type, ['technicien', 'ingenieur'], true)) {
            OrdreMissionLigne::query()
                ->where('ordre_mission_id', $ordreMission->id)
                ->whereDoesntHave('missionTasks')
                ->each(fn (OrdreMissionLigne $ligne) => $ligne->ensureTaskExists());
        }

        return response()->json(
            $ordreMission->load(self::WITH)
        );
    }

    /**
     * Génère / resynchronise les ordres de mission depuis un bon de commande.
     */
    public function generateFromBC(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (! in_array($bonCommande->statut, [
            BonCommande::STATUT_CONFIRME,
            BonCommande::STATUT_EN_COURS,
            BonCommande::STATUT_LIVRE,
        ], true)) {
            return response()->json([
                'message' => 'Le bon de commande doit être confirmé ou en cours pour générer des ordres de mission.',
            ], 422);
        }

        $existingIds = OrdreMission::query()->where('bon_commande_id', $bonCommande->id)->pluck('id')->all();
        $orders = $this->generator->generate($bonCommande, $request->user());

        if ($orders === []) {
            return response()->json([
                'message' => 'Aucun ordre de mission généré : le bon de commande ne contient aucune ligne éligible (actions catalogue, déclencheurs OdM ou lignes avec libellé).',
                'data' => [],
            ], 422);
        }

        $hasNewOrder = collect($orders)->contains(fn (OrdreMission $order) => ! in_array($order->id, $existingIds, true));

        return response()->json($orders, $hasNewOrder ? 201 : 200);
    }

    public function update(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'statut'              => 'sometimes|in:brouillon,planifie,en_cours,termine,annule',
            'date_prevue'         => 'nullable|date',
            'date_debut'          => 'nullable|date',
            'date_fin'            => 'nullable|date',
            'responsable_id'      => 'nullable|exists:users,id',
            'notes'               => 'nullable|string',
            'lab_centre_group_id' => 'sometimes|nullable|integer|exists:lab_centre_groups,id',
        ]);

        if (($validated['statut'] ?? null) === OrdreMission::STATUT_EN_COURS && ! $ordreMission->date_debut) {
            $validated['date_debut'] = now();
        }
        if (($validated['statut'] ?? null) === OrdreMission::STATUT_TERMINE) {
            $validated['date_debut'] ??= $ordreMission->date_debut ?? now();
            $validated['date_fin'] ??= $ordreMission->date_fin ?? now();
        }

        $ordreMission->update($validated);
        $ordreMission->syncMissionTasksFromLignes();

        return response()->json($ordreMission->fresh()->load(self::WITH));
    }

    public function destroy(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $ordreMission->delete();

        return response()->json(null, 204);
    }

    public function storeLigne(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'libelle' => 'required_without:ref_article_id|nullable|string|max:500',
            'quantite' => 'nullable|numeric|min:0.001',
            'ref_article_id' => 'nullable|exists:ref_articles,id',
            'article_action_id' => 'nullable|exists:article_actions,id',
            'assigned_user_id' => 'nullable|exists:users,id',
            'date_prevue' => 'nullable|date',
            'statut' => 'sometimes|in:planifie,replanifie,en_cours,freeze,annule,attente_validation,cloture,a_faire,realise',
        ]);

        $libelle = trim((string) ($validated['libelle'] ?? ''));
        $refArticleId = isset($validated['ref_article_id']) ? (int) $validated['ref_article_id'] : null;
        $articleActionId = isset($validated['article_action_id']) ? (int) $validated['article_action_id'] : null;

        if ($refArticleId) {
            $article = Article::query()->findOrFail($refArticleId);
            if ($libelle === '') {
                $libelle = (string) $article->libelle;
            }
        }

        if ($articleActionId) {
            $action = ArticleAction::query()->findOrFail($articleActionId);
            if ($refArticleId && (int) $action->ref_article_id !== $refArticleId) {
                return response()->json(['message' => 'L’action catalogue ne correspond pas à l’article sélectionné.'], 422);
            }
            if ($action->type !== $this->actionTypeForOrdreMission($ordreMission->type)) {
                return response()->json(['message' => 'Cette action catalogue n’est pas compatible avec le type d’OdM.'], 422);
            }
            $libelle = $action->libelle ?: $libelle;
            $refArticleId ??= (int) $action->ref_article_id;
        }

        if ($libelle === '') {
            return response()->json(['message' => 'Libellé ou article catalogue requis.'], 422);
        }

        $nextOrdre = ((int) $ordreMission->lignes()->max('ordre')) + 1;

        $ligne = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $ordreMission->id,
            'bon_commande_ligne_id' => null,
            'ref_article_id' => $refArticleId,
            'article_action_id' => $articleActionId,
            'libelle' => $libelle,
            'quantite' => $validated['quantite'] ?? 1,
            'statut' => $validated['statut'] ?? 'planifie',
            'assigned_user_id' => $validated['assigned_user_id'] ?? null,
            'date_prevue' => $validated['date_prevue'] ?? null,
            'ordre' => $nextOrdre,
        ]);

        $ligne->ensureTaskExists();

        return response()->json(
            $ligne->fresh()->load(['assignedUser:id,name', 'equipment:id,name,code', 'article:id,code,libelle', 'articleAction']),
            201
        );
    }

    public function updateLigne(Request $request, OrdreMission $ordreMission, OrdreMissionLigne $ligne): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        abort_if($ligne->ordre_mission_id !== $ordreMission->id, 404);

        $validated = $request->validate([
            'libelle'             => 'sometimes|required|string|max:500',
            'quantite'           => 'sometimes|numeric|min:0.001',
            'statut'              => 'sometimes|in:planifie,replanifie,en_cours,freeze,annule,attente_validation,cloture,a_faire,realise',
            'assigned_user_id'    => 'nullable|exists:users,id',
            'equipment_id'        => 'nullable|exists:equipments,id',
            'date_prevue'         => 'nullable|date',
            'date_realisation'    => 'nullable|date',
            'duree_reelle_heures' => 'nullable|integer|min:0',
            'notes'               => 'nullable|string',
        ]);

        $ligne->update($validated);
        $ligne->refresh();
        $task = $ligne->ensureTaskExists();
        $this->syncTaskStatusFromLigne($ligne, $task);
        $this->syncPlanningFromLigne($ligne, $task);
        $this->syncOrdreMissionStatusFromLignes($ordreMission);

        return response()->json($ligne->fresh()->load(['assignedUser:id,name', 'equipment:id,name,code']));
    }

    public function updateLignes(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'lignes' => 'required|array|min:1',
            'lignes.*.id' => 'required|integer|distinct',
            'lignes.*.libelle' => 'sometimes|required|string|max:500',
            'lignes.*.quantite' => 'sometimes|numeric|min:0.001',
            'lignes.*.statut' => 'sometimes|in:planifie,replanifie,en_cours,freeze,annule,attente_validation,cloture,a_faire,realise',
            'lignes.*.assigned_user_id' => 'sometimes|nullable|exists:users,id',
            'lignes.*.equipment_id' => 'sometimes|nullable|exists:equipments,id',
            'lignes.*.date_prevue' => 'sometimes|nullable|date',
            'lignes.*.date_realisation' => 'sometimes|nullable|date',
            'lignes.*.duree_reelle_heures' => 'sometimes|nullable|integer|min:0',
            'lignes.*.notes' => 'sometimes|nullable|string',
        ]);

        $payloads = collect($validated['lignes'])->keyBy(fn (array $item) => (int) $item['id']);
        $lignes = $ordreMission->lignes()
            ->whereIn('id', $payloads->keys())
            ->get()
            ->keyBy('id');

        abort_if($lignes->count() !== $payloads->count(), 404);

        DB::transaction(function () use ($ordreMission, $payloads, $lignes) {
            foreach ($payloads as $ligneId => $payload) {
                /** @var OrdreMissionLigne $ligne */
                $ligne = $lignes->get($ligneId);
                $ligne->update(collect($payload)->except('id')->all());
                $ligne->refresh();
                $task = $ligne->ensureTaskExists();
                $this->syncTaskStatusFromLigne($ligne, $task);
                $this->syncPlanningFromLigne($ligne, $task);
            }

            $this->syncOrdreMissionStatusFromLignes($ordreMission);
        });

        return response()->json(
            $ordreMission->lignes()
                ->whereIn('id', $payloads->keys())
                ->with(['assignedUser:id,name', 'equipment:id,name,code'])
                ->orderBy('ordre')
                ->get()
        );
    }

    public function destroyLigne(Request $request, OrdreMission $ordreMission, OrdreMissionLigne $ligne): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        abort_if($ligne->ordre_mission_id !== $ordreMission->id, 404);

        $ligne->missionTasks()->each(function (MissionTask $task) {
            $task->delete();
        });
        $ligne->delete();

        return response()->json(null, 204);
    }

    private function actionTypeForOrdreMission(string $omType): string
    {
        return match ($omType) {
            OrdreMission::TYPE_LABO => 'labo',
            OrdreMission::TYPE_INGENIEUR => 'ingenieur',
            default => 'technicien',
        };
    }

    private function syncTaskStatusFromLigne(OrdreMissionLigne $ligne, MissionTask $task): void
    {
        $statut = match ($ligne->statut) {
            'en_cours' => MissionTask::STATUT_IN_PROGRESS,
            'freeze' => MissionTask::STATUT_FROZEN,
            'replanifie' => MissionTask::STATUT_RESCHEDULED,
            'attente_validation', 'realise' => MissionTask::STATUT_DONE,
            'cloture' => MissionTask::STATUT_VALIDATED,
            'annule' => MissionTask::STATUT_REJECTED,
            default => MissionTask::STATUT_TODO,
        };

        $updates = ['statut' => $statut];
        if ($statut === MissionTask::STATUT_IN_PROGRESS && ! $task->started_at) {
            $updates['started_at'] = now();
        }
        if ($statut === MissionTask::STATUT_DONE && ! $task->completed_at) {
            $updates['completed_at'] = now();
        }
        $task->update($updates);
    }

    private function syncPlanningFromLigne(OrdreMissionLigne $ligne, MissionTask $task): void
    {
        $date = $ligne->date_prevue?->format('Y-m-d');

        if ($ligne->assigned_user_id && $date) {
            PlanningHuman::query()->updateOrCreate(
                ['mission_task_id' => $task->id],
                [
                    'user_id' => $ligne->assigned_user_id,
                    'date_debut' => $date,
                    'date_fin' => $date,
                    'type_evenement' => 'tache',
                    'notes' => $ligne->libelle,
                ]
            );
        } else {
            PlanningHuman::query()->where('mission_task_id', $task->id)->delete();
        }

        if ($ligne->equipment_id && $date) {
            PlanningEquipment::query()->updateOrCreate(
                ['mission_task_id' => $task->id],
                [
                    'equipment_id' => $ligne->equipment_id,
                    'user_id' => $ligne->assigned_user_id,
                    'date_debut' => $date,
                    'date_fin' => $date,
                    'type_evenement' => 'utilisation',
                    'notes' => $ligne->libelle,
                ]
            );
        } else {
            PlanningEquipment::query()->where('mission_task_id', $task->id)->delete();
        }
    }

    private function syncOrdreMissionStatusFromLignes(OrdreMission $ordreMission): void
    {
        $lignes = $ordreMission->lignes()->get();
        if ($lignes->isEmpty()) {
            return;
        }

        $now = now();
        if ($lignes->every(fn (OrdreMissionLigne $item) => $item->statut === 'annule')) {
            $ordreMission->update(['statut' => OrdreMission::STATUT_ANNULE]);
            return;
        }
        if ($lignes->every(fn (OrdreMissionLigne $item) => in_array($item->statut, ['cloture', 'annule'], true))) {
            $ordreMission->update([
                'statut' => OrdreMission::STATUT_TERMINE,
                'date_debut' => $ordreMission->date_debut ?? $now,
                'date_fin' => $ordreMission->date_fin ?? $now,
            ]);
            return;
        }
        if ($lignes->contains(fn (OrdreMissionLigne $item) => in_array($item->statut, ['en_cours', 'freeze', 'attente_validation', 'cloture'], true))) {
            $ordreMission->update([
                'statut' => OrdreMission::STATUT_EN_COURS,
                'date_debut' => $ordreMission->date_debut ?? $now,
            ]);
            return;
        }
        $active = $lignes->reject(fn (OrdreMissionLigne $item) => $item->statut === 'annule');
        $ordreMission->update(['statut' => $active->isNotEmpty()
            && $active->every(fn (OrdreMissionLigne $item) => $item->assigned_user_id && $item->date_prevue)
            ? OrdreMission::STATUT_PLANIFIE
            : OrdreMission::STATUT_BROUILLON]);
    }

    public function planning(Request $request): JsonResponse
    {
        $from = $request->query('from', now()->startOfMonth()->toDateString());
        $to   = $request->query('to', now()->endOfMonth()->toDateString());
        $type = $request->query('type');

        $q = OrdreMission::with([
            'client:id,name',
            'responsable:id,name',
            'lignes.assignedUser:id,name',
            'lignes.equipment:id,name,code',
        ])
            ->whereBetween('date_prevue', [$from, $to])
            ->whereIn('statut', ['planifie', 'en_cours', 'brouillon']);

        if ($type) {
            $q->where('type', $type);
        }

        return response()->json($q->orderBy('date_prevue')->get());
    }

    public function fraisIndex(OrdreMission $ordreMission, ExpenseReportService $expenseReports): JsonResponse
    {
        $report = $ordreMission->expenseReports()->orderBy('id')->first();
        if ($report === null) {
            return response()->json([]);
        }

        $lines = $expenseReports
            ->expenseLinesQuery($report)
            ->with('user:id,name,expense_taux_km,expense_plafond_repas,expense_forfait_repas')
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->map(fn (ExpenseLine $line) => $expenseReports->expenseLineToFraisPayload($line, $report));

        return response()->json($lines);
    }

    public function fraisStore(Request $request, OrdreMission $ordreMission, ExpenseReportService $expenseReports): JsonResponse
    {
        $validated = $request->validate([
            'type'            => 'required|in:repas,deplacement,autres',
            'user_id'         => 'required|exists:users,id',
            'date'            => 'required|date',
            'amount'          => 'nullable|numeric|min:0',
            'payment_method'  => 'nullable|in:' . implode(',', ExpenseLine::PAYMENT_METHODS),
            'description'     => 'nullable|string|max:512',
            'lieu_depart'     => 'nullable|string|max:255',
            'lieu_arrivee'    => 'nullable|string|max:255',
            'distance_km'     => 'nullable|numeric|min:0',
            'taux_km'         => 'nullable|numeric|min:0',
            'type_transport'  => 'nullable|in:voiture,moto,velo,transports_commun,autre',
            'notes'           => 'nullable|string',
        ]);

        $type = $validated['type'];
        $report = $expenseReports->firstOrCreateForOrdreMission($ordreMission, (int) $validated['user_id']);
        $taux = (float) ($validated['taux_km'] ?? $expenseReports->defaultTauxKmForUserId((int) $validated['user_id']));

        if ($type === 'deplacement') {
            abort_if(! isset($validated['distance_km']), 422, 'La distance est requise pour un déplacement.');
            $distance = (float) $validated['distance_km'];
            $line = $report->lines()->create([
                'user_id'        => $validated['user_id'],
                'category'       => 'Voyage',
                'amount'         => $expenseReports->computeDeplacementAmount($distance, $taux),
                'date'           => $validated['date'],
                'description'    => $expenseReports->buildDeplacementDescription(
                    $validated['lieu_depart'] ?? null,
                    $validated['lieu_arrivee'] ?? null,
                    $validated['notes'] ?? $validated['description'] ?? null,
                ),
                'lieu_depart'    => $validated['lieu_depart'] ?? null,
                'lieu_arrivee'   => $validated['lieu_arrivee'] ?? null,
                'distance_km'    => $distance,
                'taux_km'        => $taux,
                'type_transport' => $validated['type_transport'] ?? 'voiture',
                'payment_method' => $validated['payment_method'] ?? null,
            ]);
        } else {
            $amount = (float) ($validated['amount'] ?? 0);
            abort_if($amount <= 0, 422, 'Le montant est requis.');
            $line = $report->lines()->create([
                'user_id'        => $validated['user_id'],
                'category'       => $expenseReports->categoryForFraisType($type),
                'amount'         => $amount,
                'date'           => $validated['date'],
                'description'    => $validated['description'] ?? $validated['notes'] ?? null,
                'payment_method' => $validated['payment_method'] ?? null,
            ]);
        }

        return response()->json(
            $expenseReports->expenseLineToFraisPayload($line->fresh(), $report->fresh()),
            201,
        );
    }

    public function fraisUpdate(
        Request $request,
        OrdreMission $ordreMission,
        ExpenseLine $frais,
        ExpenseReportService $expenseReports,
    ): JsonResponse {
        $report = $expenseReports->assertLineBelongsToOrdreMission($frais, $ordreMission);

        if ($frais->isDeplacement()) {
            $validated = $request->validate([
                'date'           => 'sometimes|date',
                'lieu_depart'    => 'nullable|string|max:255',
                'lieu_arrivee'   => 'nullable|string|max:255',
                'distance_km'    => 'sometimes|numeric|min:0',
                'taux_km'        => 'nullable|numeric|min:0',
                'type_transport' => 'nullable|in:voiture,moto,velo,transports_commun,autre',
                'notes'          => 'nullable|string',
                'payment_method' => 'nullable|in:' . implode(',', ExpenseLine::PAYMENT_METHODS),
            ]);

            $distance = array_key_exists('distance_km', $validated)
                ? (float) $validated['distance_km']
                : (float) ($frais->distance_km ?? 0);
            $taux = array_key_exists('taux_km', $validated)
                ? (float) ($validated['taux_km'] ?? $expenseReports->defaultTauxKmForUserId((int) $frais->user_id))
                : (float) ($frais->taux_km ?? $expenseReports->defaultTauxKmForUserId((int) $frais->user_id));

            $lieuDepart = array_key_exists('lieu_depart', $validated) ? $validated['lieu_depart'] : $frais->lieu_depart;
            $lieuArrivee = array_key_exists('lieu_arrivee', $validated) ? $validated['lieu_arrivee'] : $frais->lieu_arrivee;
            $notes = array_key_exists('notes', $validated) ? $validated['notes'] : $frais->description;

            $frais->update([
                ...$validated,
                'amount'      => $expenseReports->computeDeplacementAmount($distance, $taux),
                'distance_km' => $distance,
                'taux_km'     => $taux,
                'description' => $expenseReports->buildDeplacementDescription($lieuDepart, $lieuArrivee, $notes),
            ]);
        } else {
            $validated = $request->validate([
                'date'           => 'sometimes|date',
                'amount'         => 'sometimes|numeric|min:0',
                'description'    => 'nullable|string|max:512',
                'notes'          => 'nullable|string',
                'payment_method' => 'nullable|in:' . implode(',', ExpenseLine::PAYMENT_METHODS),
            ]);

            $frais->update([
                ...$validated,
                'description' => $validated['description'] ?? $validated['notes'] ?? $frais->description,
            ]);
        }

        return response()->json(
            $expenseReports->expenseLineToFraisPayload($frais->fresh()->load('user:id,name'), $report->fresh()),
        );
    }

    public function fraisDestroy(
        OrdreMission $ordreMission,
        ExpenseLine $frais,
        ExpenseReportService $expenseReports,
    ): JsonResponse {
        $report = $expenseReports->assertLineBelongsToOrdreMission($frais, $ordreMission);
        $frais->delete();

        if (! $report->lines()->exists()) {
            $report->delete();
        }

        return response()->json(null, 204);
    }
}
