<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentSequence;
use App\Models\SituationTravaux;
use App\Services\DocumentSequenceService;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SituationTravauxController extends Controller
{
    public function __construct(
        private readonly DocumentSequenceService $sequences
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = SituationTravaux::query()->with(['dossier', 'invoice'])->orderByDesc('id');
        if ($request->filled('dossier_id')) {
            $q->where('dossier_id', (int) $request->query('dossier_id'));
        }
        if ($request->user()->isLab()) {
            return response()->json($q->get());
        }
        if (! $request->user()->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $q->whereHas('dossier', fn ($d) => $d->where('client_id', $request->user()->client_id));

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $data = $request->validate([
            'dossier_id' => 'required|exists:dossiers,id',
            'invoice_id' => 'nullable|exists:invoices,id',
            'label' => 'required|string|max:255',
            'percent_complete' => 'sometimes|numeric|min:0|max:100',
            'amount_ht' => 'sometimes|numeric|min:0',
            'status' => 'sometimes|string|max:32',
        ]);
        $numero = $this->sequences->next(DocumentSequence::TYPE_SITUATION);
        $row = SituationTravaux::query()->create(array_merge($data, [
            'numero' => $numero,
            'created_by' => $request->user()->id,
        ]));

        return response()->json($row->load(['dossier', 'invoice']), 201);
    }

    public function show(Request $request, SituationTravaux $situationTravaux): JsonResponse
    {
        $situationTravaux->loadMissing('dossier');
        if (! AgencyAccess::userMayAccessDossier($request->user(), $situationTravaux->dossier)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($situationTravaux->load(['dossier', 'invoice']));
    }
}
