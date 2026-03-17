<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BtpCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BtpCalculationController extends Controller
{
    /**
     * Liste des exemples de calculs (formules, exemples entrée/sortie) pour le back-office.
     */
    public function exemples(): JsonResponse
    {
        return response()->json(BtpCalculationService::getExemplesCalculs());
    }

    /**
     * Exécute un calcul (pour le mini-calculateur du back-office).
     */
    public function calculer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|string',
            'valeurs' => 'required|array',
        ]);

        $resultat = BtpCalculationService::calculer($validated['id'], $validated['valeurs']);

        if ($resultat === null) {
            return response()->json(['message' => 'Calcul inconnu ou données invalides'], 422);
        }

        return response()->json(['resultat' => $resultat]);
    }
}
