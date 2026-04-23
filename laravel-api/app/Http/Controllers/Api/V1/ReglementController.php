<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentSequence;
use App\Models\Reglement;
use App\Services\DocumentSequenceService;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReglementController extends Controller
{
    public function __construct(
        private readonly DocumentSequenceService $sequences
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = Reglement::query()->with(['client', 'invoice', 'bonLivraison'])->orderByDesc('payment_date');
        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->query('client_id'));
        }
        if ($request->filled('invoice_id')) {
            $q->where('invoice_id', (int) $request->query('invoice_id'));
        }
        if ($request->user()->isLab()) {
            return response()->json($q->get());
        }
        if (! $request->user()->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($q->where('client_id', $request->user()->client_id)->get());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $data = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'invoice_id' => 'nullable|exists:invoices,id',
            'bon_livraison_id' => 'nullable|exists:bons_livraison,id',
            'amount_ttc' => 'required|numeric|min:0',
            'payment_mode' => 'sometimes|string|max:32',
            'payment_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);
        $numero = $this->sequences->next(DocumentSequence::TYPE_REGLEMENT);
        $row = Reglement::query()->create(array_merge($data, [
            'numero' => $numero,
            'created_by' => $request->user()->id,
        ]));

        return response()->json($row->load(['client', 'invoice']), 201);
    }

    public function show(Request $request, Reglement $reglement): JsonResponse
    {
        if (! $this->may($request, $reglement)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($reglement->load(['client', 'invoice', 'bonLivraison']));
    }

    private function may(Request $request, Reglement $r): bool
    {
        if ($request->user()->isLab()) {
            return true;
        }
        if (! $request->user()->client_id || (int) $r->client_id !== (int) $request->user()->client_id) {
            return false;
        }
        if ($r->invoice_id) {
            $r->loadMissing('invoice');

            return AgencyAccess::userMayAccessInvoice($request->user(), $r->invoice);
        }

        return true;
    }
}
