<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BonCommande;
use App\Services\CommercialDocumentWorkflowService;
use App\Support\AgencyAccess;
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
            ->with(['dossier', 'client', 'lignes'])
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
        $bonCommande->load(['lignes', 'dossier', 'client', 'quote', 'bonsLivraison.lignes']);

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
        ]);
        if ($data !== []) {
            $bonCommande->update($data);
        }

        return response()->json($bonCommande->fresh()->load(['lignes', 'dossier', 'client']));
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
