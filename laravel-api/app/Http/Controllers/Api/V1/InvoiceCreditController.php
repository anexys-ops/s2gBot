<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentSequence;
use App\Models\Invoice;
use App\Models\InvoiceCredit;
use App\Services\DocumentSequenceService;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceCreditController extends Controller
{
    public function __construct(
        private readonly DocumentSequenceService $sequences
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = InvoiceCredit::query()->with(['client', 'sourceInvoice'])->orderByDesc('id');
        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->query('client_id'));
        }
        if ($request->filled('source_invoice_id')) {
            $q->where('source_invoice_id', (int) $request->query('source_invoice_id'));
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
            'source_invoice_id' => 'required|exists:invoices,id',
            'amount_ttc' => 'required|numeric|min:0',
            'reason' => 'nullable|string',
            'status' => 'sometimes|string|max:32',
        ]);
        $inv = Invoice::query()->findOrFail($data['source_invoice_id']);
        if ((int) $inv->client_id !== (int) $data['client_id']) {
            return response()->json(['message' => 'Le client ne correspond pas à la facture source.'], 422);
        }
        $numero = $this->sequences->next(DocumentSequence::TYPE_AVOIR);
        $row = InvoiceCredit::query()->create(array_merge($data, [
            'numero' => $numero,
            'created_by' => $request->user()->id,
        ]));

        return response()->json($row->load(['client', 'sourceInvoice']), 201);
    }

    public function show(Request $request, InvoiceCredit $invoiceCredit): JsonResponse
    {
        $invoiceCredit->loadMissing('sourceInvoice');
        if ($request->user()->isLab()) {
            return response()->json($invoiceCredit->load(['client', 'sourceInvoice']));
        }
        if (! AgencyAccess::userMayAccessInvoice($request->user(), $invoiceCredit->sourceInvoice)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($invoiceCredit->load(['client', 'sourceInvoice']));
    }
}
