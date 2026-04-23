<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Services\CommercialDocumentWorkflowService;
use App\Support\AgencyAccess;
use App\Support\ClientContactDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BonCommandeController extends Controller
{
    public function __construct(
        private readonly CommercialDocumentWorkflowService $workflow
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = BonCommande::query()
            ->with(['dossier', 'client', 'clientContact', 'lignes'])
            ->orderByDesc('date_commande')
            ->orderByDesc('id');
        if ($request->filled('dossier_id')) {
            $q->where('dossier_id', (int) $request->query('dossier_id'));
        }
        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->query('client_id'));
        }
        if ($request->filled('statut')) {
            $q->where('statut', (string) $request->query('statut'));
        }
        if ($request->user()->isLab()) {
            return response()->json($q->get());
        }
        if (! $request->user()->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $q->where('client_id', $request->user()->client_id);

        return response()->json($q->get());
    }

    public function show(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $bonCommande->load([
            'lignes.planningAffectations.user',
            'dossier',
            'client',
            'clientContact',
            'quote',
            'bonsLivraison.lignes',
        ]);

        return response()->json($bonCommande);
    }

    public function update(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'notes' => 'sometimes|nullable|string',
            'date_livraison_prevue' => 'sometimes|nullable|date',
            'montant_ht' => 'sometimes|numeric|min:0',
            'montant_ttc' => 'sometimes|numeric|min:0',
            'contact_id' => 'sometimes|nullable|exists:client_contacts,id',
        ]);
        if ($data !== []) {
            $bonCommande->update($data);
            $bonCommande->refresh();
            ClientContactDocument::assertBelongsToClient($bonCommande->contact_id, (int) $bonCommande->client_id);
        }

        return response()->json($bonCommande->fresh()->load([
            'lignes.planningAffectations.user',
            'dossier',
            'client',
            'clientContact',
        ]));
    }

    public function updateLigne(
        Request $request,
        BonCommande $bonCommande,
        BonCommandeLigne $ligne
    ): JsonResponse {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ((int) $ligne->bon_commande_id !== (int) $bonCommande->id) {
            return response()->json(['message' => 'Ligne introuvable pour ce bon de commande.'], 404);
        }

        $data = $request->validate([
            'date_debut_prevue' => 'sometimes|nullable|date',
            'date_fin_prevue' => 'sometimes|nullable|date',
        ]);
        if ($data === []) {
            $ligne->load('planningAffectations.user');

            return response()->json($ligne);
        }
        if (array_key_exists('date_debut_prevue', $data)) {
            $ligne->date_debut_prevue = $data['date_debut_prevue'];
        }
        if (array_key_exists('date_fin_prevue', $data)) {
            $ligne->date_fin_prevue = $data['date_fin_prevue'];
        }
        if ($ligne->date_debut_prevue && $ligne->date_fin_prevue
            && $ligne->date_debut_prevue->format('Y-m-d') > $ligne->date_fin_prevue->format('Y-m-d')
        ) {
            return response()->json(['message' => 'La date de début ne peut pas être postérieure à la date de fin.'], 422);
        }

        $ligne->save();
        $ligne->load('planningAffectations.user');

        return response()->json($ligne);
    }

    public function confirmer(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($bonCommande->statut !== BonCommande::STATUT_BROUILLON) {
            return response()->json(['message' => 'Seul un BC en brouillon peut être confirmé.'], 422);
        }
        $bonCommande->update(['statut' => BonCommande::STATUT_CONFIRME]);

        return response()->json($bonCommande->fresh()->load('lignes'));
    }

    public function transformerBl(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        try {
            $bl = $this->workflow->createBonLivraisonFromBonCommande($bonCommande, $request->user());
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($bl->load(['dossier', 'client', 'lignes']), 201);
    }
}
