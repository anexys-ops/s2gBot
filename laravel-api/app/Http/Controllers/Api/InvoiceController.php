<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Services\CommercialDocumentTotalsService;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Invoice::query()->with([
            'client',
            'orders',
            'invoiceLines',
            'billingAddress',
            'deliveryAddress',
            'pdfTemplate',
        ]);

        if ($user->isClient()) {
            $query->where('client_id', $user->client_id);
        } elseif ($user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', '%'.$search.'%')
                    ->orWhereHas('client', function ($cq) use ($search) {
                        $cq->where('name', 'like', '%'.$search.'%');
                    });
            });
        }

        if ($status = trim((string) $request->query('status', ''))) {
            $query->where('status', $status);
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
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'status' => ['nullable', Rule::in(Invoice::statuses())],
            'amount_ht' => 'nullable|numeric|min:0',
            'lines' => 'nullable|array|min:1',
            'lines.*.description' => 'required_with:lines|string|max:500',
            'lines.*.quantity' => 'required_with:lines|integer|min:1',
            'lines.*.unit_price' => 'required_with:lines|numeric|min:0',
            'lines.*.tva_rate' => 'nullable|numeric|min:0|max:100',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'meta' => 'nullable|array',
        ]);

        $tvaRate = $validated['tva_rate'] ?? 20;

        $invoice = Invoice::create([
            'number' => $validated['number'],
            'client_id' => $validated['client_id'],
            'invoice_date' => $validated['invoice_date'],
            'order_date' => $validated['order_date'] ?? null,
            'site_delivery_date' => $validated['site_delivery_date'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => $tvaRate,
            'discount_percent' => $validated['discount_percent'] ?? 0,
            'discount_amount' => $validated['discount_amount'] ?? 0,
            'shipping_amount_ht' => $validated['shipping_amount_ht'] ?? 0,
            'shipping_tva_rate' => $validated['shipping_tva_rate'] ?? 20,
            'travel_fee_ht' => $validated['travel_fee_ht'] ?? 0,
            'travel_fee_tva_rate' => $validated['travel_fee_tva_rate'] ?? 20,
            'billing_address_id' => $validated['billing_address_id'] ?? null,
            'delivery_address_id' => $validated['delivery_address_id'] ?? null,
            'pdf_template_id' => $validated['pdf_template_id'] ?? null,
            'status' => $validated['status'] ?? Invoice::STATUS_DRAFT,
            'meta' => $validated['meta'] ?? null,
        ]);

        if (! empty($validated['lines'])) {
            foreach ($validated['lines'] as $line) {
                $tva = isset($line['tva_rate']) ? (float) $line['tva_rate'] : $tvaRate;
                $disc = isset($line['discount_percent']) ? (float) $line['discount_percent'] : 0;
                $ht = CommercialDocumentTotalsService::lineHt(
                    (float) $line['quantity'],
                    (float) $line['unit_price'],
                    $disc,
                );
                InvoiceLine::create([
                    'invoice_id' => $invoice->id,
                    'description' => $line['description'],
                    'quantity' => (int) $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tva_rate' => $tva,
                    'discount_percent' => $disc,
                    'total' => $ht,
                ]);
            }
            $this->invoiceService->recalculateTotals($invoice);
        } elseif (isset($validated['amount_ht'])) {
            $amountTtc = $validated['amount_ht'] * (1 + $tvaRate / 100);
            $invoice->update([
                'amount_ht' => $validated['amount_ht'],
                'amount_ttc' => round($amountTtc, 2),
            ]);
        }

        return response()->json($invoice->fresh()->load([
            'client', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
        ]), 201);
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

        return response()->json($invoice->load([
            'client', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate', 'attachments',
        ]));
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $statusRule = Rule::in(Invoice::statuses());

        if ($invoice->status !== Invoice::STATUS_DRAFT) {
            $validated = $request->validate([
                'status' => ['sometimes', $statusRule],
                'due_date' => 'nullable|date',
                'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
                'meta' => 'nullable|array',
            ]);
            $invoice->update($validated);

            return response()->json($invoice->fresh()->load([
                'client', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
            ]));
        }

        $validated = $request->validate([
            'number' => 'sometimes|string|max:50|unique:invoices,number,'.$invoice->id,
            'client_id' => 'sometimes|exists:clients,id',
            'invoice_date' => 'sometimes|date',
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'status' => ['sometimes', $statusRule],
            'lines' => 'sometimes|array|min:1',
            'lines.*.description' => 'required_with:lines|string|max:500',
            'lines.*.quantity' => 'required_with:lines|integer|min:1',
            'lines.*.unit_price' => 'required_with:lines|numeric|min:0',
            'lines.*.tva_rate' => 'nullable|numeric|min:0|max:100',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'meta' => 'nullable|array',
        ]);

        $invoice->fill(collect($validated)->except('lines')->toArray());

        if (isset($validated['lines'])) {
            $defaultTva = $validated['tva_rate'] ?? $invoice->tva_rate;
            $invoice->invoiceLines()->delete();
            foreach ($validated['lines'] as $line) {
                $tva = isset($line['tva_rate']) ? (float) $line['tva_rate'] : (float) $defaultTva;
                $disc = isset($line['discount_percent']) ? (float) $line['discount_percent'] : 0;
                $ht = CommercialDocumentTotalsService::lineHt(
                    (float) $line['quantity'],
                    (float) $line['unit_price'],
                    $disc,
                );
                InvoiceLine::create([
                    'invoice_id' => $invoice->id,
                    'description' => $line['description'],
                    'quantity' => (int) $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tva_rate' => $tva,
                    'discount_percent' => $disc,
                    'total' => $ht,
                ]);
            }
        }

        $invoice->save();
        if ($invoice->invoiceLines()->exists()) {
            $this->invoiceService->recalculateTotals($invoice);
        }

        return response()->json($invoice->fresh()->load([
            'client', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
        ]));
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
