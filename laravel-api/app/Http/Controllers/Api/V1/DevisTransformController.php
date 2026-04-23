<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Quote;
use App\Services\CommercialDocumentWorkflowService;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DevisTransformController extends Controller
{
    public function __construct(
        private readonly CommercialDocumentWorkflowService $workflow
    ) {}

    public function store(Request $request, Quote $quote): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessQuote($request->user(), $quote)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        try {
            $bc = $this->workflow->createBonCommandeFromQuote($quote, $request->user());
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($bc->load(['dossier', 'client', 'lignes']), 201);
    }
}
