<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BonLivraison;
use App\Models\BonLivraisonLigne;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BonLivraisonController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = BonLivraison::query()
            ->with(['dossier', 'client', 'lignes'])
            ->orderByDesc('date_livraison')
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

    public function show(Request $request, BonLivraison $bonLivraison): JsonResponse
    {
        if (! AgencyAccess::userMayAccessBonLivraison($request->user(), $bonLivraison)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $bonLivraison->load(['lignes', 'dossier', 'client', 'bonCommande']);

        return response()->json($bonLivraison);
    }

    public function update(Request $request, BonLivraison $bonLivraison): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonLivraison($request->user(), $bonLivraison)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'notes' => 'sometimes|nullable|string',
            'date_livraison' => 'sometimes|date',
            'lignes' => 'sometimes|array',
            'lignes.*.id' => 'required|integer|exists:bons_livraison_lignes,id',
            'lignes.*.quantite_livree' => 'required|numeric|min:0',
        ]);
        if (array_key_exists('notes', $data) || array_key_exists('date_livraison', $data)) {
            $u = array_intersect_key($data, array_flip(['notes', 'date_livraison']));
            if ($u !== []) {
                $bonLivraison->update($u);
            }
        }
        if (! empty($data['lignes'])) {
            foreach ($data['lignes'] as $row) {
                $lid = (int) $row['id'];
                $ligne = BonLivraisonLigne::query()
                    ->where('bon_livraison_id', $bonLivraison->id)
                    ->whereKey($lid)
                    ->first();
                if ($ligne) {
                    $ligne->update(['quantite_livree' => $row['quantite_livree']]);
                }
            }
        }

        return response()->json($bonLivraison->fresh()->load('lignes'));
    }

    public function valider(Request $request, BonLivraison $bonLivraison): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonLivraison($request->user(), $bonLivraison)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($bonLivraison->statut !== BonLivraison::STATUT_BROUILLON) {
            return response()->json(['message' => 'Seul un BL en brouillon peut être validé.'], 422);
        }
        $bonLivraison->update(['statut' => BonLivraison::STATUT_LIVRE]);

        return response()->json($bonLivraison->fresh()->load('lignes'));
    }
}
