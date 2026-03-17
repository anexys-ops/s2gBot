<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Invoice::query()->with(['client', 'orders', 'invoiceLines']);

        if ($user->isClient()) {
            $query->where('client_id', $user->client_id);
        } elseif ($user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        $invoices = $query->orderByDesc('invoice_date')->paginate(15);

        return response()->json($invoices);
    }

    public function fromOrders(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
            'client_id' => 'nullable|exists:clients,id',
        ]);

        try {
            $invoice = $this->invoiceService->fromOrders(
                $validated['order_ids'],
                $validated['client_id'] ?? null
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($invoice, 201);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'number' => 'required|string|max:50|unique:invoices,number',
            'client_id' => 'required|exists:clients,id',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'amount_ht' => 'required|numeric|min:0',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'status' => 'nullable|in:draft,sent,paid',
        ]);

        $tvaRate = $validated['tva_rate'] ?? 20;
        $amountTtc = $validated['amount_ht'] * (1 + $tvaRate / 100);

        $invoice = Invoice::create([
            'number' => $validated['number'],
            'client_id' => $validated['client_id'],
            'invoice_date' => $validated['invoice_date'],
            'due_date' => $validated['due_date'] ?? null,
            'amount_ht' => $validated['amount_ht'],
            'amount_ttc' => round($amountTtc, 2),
            'tva_rate' => $tvaRate,
            'status' => $validated['status'] ?? Invoice::STATUS_DRAFT,
        ]);

        return response()->json($invoice->load('client'), 201);
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $invoice->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $invoice->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($invoice->load(['client', 'orders', 'invoiceLines']));
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'number' => 'sometimes|string|max:50|unique:invoices,number,'.$invoice->id,
            'client_id' => 'sometimes|exists:clients,id',
            'invoice_date' => 'sometimes|date',
            'due_date' => 'nullable|date',
            'amount_ht' => 'sometimes|numeric|min:0',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'status' => 'sometimes|in:draft,sent,paid',
        ]);

        if (isset($validated['amount_ht']) || array_key_exists('tva_rate', $validated)) {
            $ht = $validated['amount_ht'] ?? $invoice->amount_ht;
            $rate = $validated['tva_rate'] ?? $invoice->tva_rate;
            $validated['amount_ttc'] = round($ht * (1 + $rate / 100), 2);
        }

        $invoice->update($validated);

        return response()->json($invoice->load(['client', 'orders', 'invoiceLines']));
    }

    public function destroy(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $invoice->delete();

        return response()->json(null, 204);
    }
}
