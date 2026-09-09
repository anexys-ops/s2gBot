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
use App\Services\ExpenseReportService;
use App\Services\OrdreMissionFromBonCommandeService;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrdreMissionController extends Controller
{
    private const WITH = [
        'client:id,name',
        'site:id,name',
        'dossier:id,reference,titre',
        'responsable:id,name',
        'bonCommande:id,numero,quote_id,dossier_id',
        'bonCommande.quote:id,number',
        'bonCommande.dossier:id,reference,titre',
        'lignes.assignedUser:id,name',
        'lignes.equipment:id,name,code',
        'lignes.articleAction',
        'lignes.article:id,code,libelle',
        'lignes.bonCommandeLigne:id,libelle,technicien_id,date_debut_prevue,date_fin_prevue',
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

        $orders = $this->generator->generate($bonCommande, $request->user());

        if ($orders === []) {
            return response()->json([
                'message' => 'Aucun ordre de mission généré : le bon de commande ne contient aucune ligne éligible (actions catalogue, déclencheurs OdM ou lignes avec libellé).',
                'data' => [],
            ], 422);
        }

        return response()->json($orders, 201);
    }

    public function update(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'statut'         => 'sometimes|in:brouillon,planifie,en_cours,termine,annule',
            'date_prevue'    => 'nullable|date',
            'date_debut'     => 'nullable|date',
            'date_fin'       => 'nullable|date',
            'responsable_id' => 'nullable|exists:users,id',
            'notes'          => 'nullable|string',
        ]);

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
            'statut' => 'sometimes|in:a_faire,en_cours,realise,annule',
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
            'statut' => $validated['statut'] ?? 'a_faire',
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
            'statut'              => 'sometimes|in:a_faire,en_cours,realise,annule',
            'assigned_user_id'    => 'nullable|exists:users,id',
            'equipment_id'        => 'nullable|exists:equipments,id',
            'date_prevue'         => 'nullable|date',
            'date_realisation'    => 'nullable|date',
            'duree_reelle_heures' => 'nullable|integer|min:0',
            'notes'               => 'nullable|string',
        ]);

        $ligne->update($validated);
        $ligne->refresh();
        $ligne->ensureTaskExists();

        return response()->json($ligne->fresh()->load(['assignedUser:id,name', 'equipment:id,name,code']));
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
            ->deplacementLinesQuery($report)
            ->with('user:id,name')
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->map(fn (ExpenseLine $line) => $expenseReports->deplacementLineToFraisPayload($line, $report));

        return response()->json($lines);
    }

    public function fraisStore(Request $request, OrdreMission $ordreMission, ExpenseReportService $expenseReports): JsonResponse
    {
        $validated = $request->validate([
            'user_id'         => 'required|exists:users,id',
            'date'            => 'required|date',
            'lieu_depart'     => 'nullable|string|max:255',
            'lieu_arrivee'    => 'nullable|string|max:255',
            'distance_km'     => 'required|numeric|min:0',
            'taux_km'         => 'nullable|numeric|min:0',
            'type_transport'  => 'nullable|in:voiture,moto,velo,transports_commun,autre',
            'notes'           => 'nullable|string',
        ]);

        $distance = (float) $validated['distance_km'];
        $taux = (float) ($validated['taux_km'] ?? 0.401);

        $report = $expenseReports->firstOrCreateForOrdreMission($ordreMission, (int) $validated['user_id']);

        $line = $report->lines()->create([
            'user_id'        => $validated['user_id'],
            'category'       => 'Voyage',
            'amount'         => $expenseReports->computeDeplacementAmount($distance, $taux),
            'date'           => $validated['date'],
            'description'    => $expenseReports->buildDeplacementDescription(
                $validated['lieu_depart'] ?? null,
                $validated['lieu_arrivee'] ?? null,
                $validated['notes'] ?? null,
            ),
            'lieu_depart'    => $validated['lieu_depart'] ?? null,
            'lieu_arrivee'   => $validated['lieu_arrivee'] ?? null,
            'distance_km'    => $distance,
            'taux_km'        => $taux,
            'type_transport' => $validated['type_transport'] ?? 'voiture',
        ]);

        return response()->json(
            $expenseReports->deplacementLineToFraisPayload($line->fresh(), $report->fresh()),
            201,
        );
    }

    public function fraisUpdate(
        Request $request,
        OrdreMission $ordreMission,
        ExpenseLine $frais,
        ExpenseReportService $expenseReports,
    ): JsonResponse {
        $report = $expenseReports->assertDeplacementLineBelongsToOrdreMission($frais, $ordreMission);

        $validated = $request->validate([
            'date'           => 'sometimes|date',
            'lieu_depart'    => 'nullable|string|max:255',
            'lieu_arrivee'   => 'nullable|string|max:255',
            'distance_km'    => 'sometimes|numeric|min:0',
            'taux_km'        => 'nullable|numeric|min:0',
            'type_transport' => 'nullable|in:voiture,moto,velo,transports_commun,autre',
            'notes'          => 'nullable|string',
        ]);

        $distance = array_key_exists('distance_km', $validated)
            ? (float) $validated['distance_km']
            : (float) ($frais->distance_km ?? 0);
        $taux = array_key_exists('taux_km', $validated)
            ? (float) ($validated['taux_km'] ?? 0.401)
            : (float) ($frais->taux_km ?? 0.401);

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

        return response()->json(
            $expenseReports->deplacementLineToFraisPayload($frais->fresh()->load('user:id,name'), $report->fresh()),
        );
    }

    public function fraisDestroy(
        OrdreMission $ordreMission,
        ExpenseLine $frais,
        ExpenseReportService $expenseReports,
    ): JsonResponse {
        $report = $expenseReports->assertDeplacementLineBelongsToOrdreMission($frais, $ordreMission);
        $frais->delete();

        if (! $report->lines()->exists()) {
            $report->delete();
        }

        return response()->json(null, 204);
    }
}
