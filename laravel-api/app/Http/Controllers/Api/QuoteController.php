<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Site;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Services\CommercialDocumentTotalsService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuoteController extends Controller
{
    private const LINE_RULES = [
        'lines' => 'required|array|min:1',
        'lines.*.commercial_offering_id' => 'nullable|exists:commercial_offerings,id',
        'lines.*.description' => 'required|string|max:500',
        'lines.*.quantity' => 'required|integer|min:1',
        'lines.*.unit_price' => 'required|numeric|min:0',
        'lines.*.tva_rate' => 'nullable|numeric|min:0|max:100',
        'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Quote::query()->with([
            'client',
            'site',
            'quoteLines.commercialOffering',
            'billingAddress',
            'deliveryAddress',
            'pdfTemplate',
        ]);

        if ($user->isClient() || $user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', '%'.$search.'%')
                    ->orWhere('notes', 'like', '%'.$search.'%')
                    ->orWhereHas('client', function ($cq) use ($search) {
                        $cq->where('name', 'like', '%'.$search.'%');
                    });
            });
        }

        if ($status = trim((string) $request->query('status', ''))) {
            $query->where('status', $status);
        }

        $quotes = $query->orderByDesc('quote_date')->paginate(15);

        return response()->json($quotes);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate(array_merge([
            'client_id' => 'required|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'quote_date' => 'required|date',
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'notes' => 'nullable|string',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'apply_site_travel' => 'nullable|boolean',
            'meta' => 'nullable|array',
        ], self::LINE_RULES));

        $number = 'DEV-'.Carbon::now()->format('Ymd').'-'.str_pad((string) (Quote::count() + 1), 4, '0', STR_PAD_LEFT);
        $defaultTva = $validated['tva_rate'] ?? 20;

        $travelHt = (float) ($validated['travel_fee_ht'] ?? 0);
        if (! empty($validated['apply_site_travel']) && ! empty($validated['site_id'])) {
            $site = Site::find($validated['site_id']);
            if ($site) {
                $travelHt = (float) $site->travel_fee_quote_ht;
            }
        }

        $quote = Quote::create([
            'number' => $number,
            'client_id' => $validated['client_id'],
            'site_id' => $validated['site_id'] ?? null,
            'quote_date' => $validated['quote_date'],
            'order_date' => $validated['order_date'] ?? null,
            'site_delivery_date' => $validated['site_delivery_date'] ?? null,
            'valid_until' => $validated['valid_until'] ?? null,
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => $defaultTva,
            'discount_percent' => $validated['discount_percent'] ?? 0,
            'discount_amount' => $validated['discount_amount'] ?? 0,
            'shipping_amount_ht' => $validated['shipping_amount_ht'] ?? 0,
            'shipping_tva_rate' => $validated['shipping_tva_rate'] ?? 20,
            'travel_fee_ht' => $travelHt,
            'travel_fee_tva_rate' => $validated['travel_fee_tva_rate'] ?? 20,
            'billing_address_id' => $validated['billing_address_id'] ?? null,
            'delivery_address_id' => $validated['delivery_address_id'] ?? null,
            'pdf_template_id' => $validated['pdf_template_id'] ?? null,
            'status' => Quote::STATUS_DRAFT,
            'notes' => $validated['notes'] ?? null,
            'meta' => $validated['meta'] ?? null,
        ]);

        $this->syncQuoteLines($quote, $validated['lines'], $defaultTva);
        $this->recalculateQuoteTotals($quote);

        return response()->json($quote->fresh()->load([
            'client', 'site', 'quoteLines.commercialOffering', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
        ]), 201);
    }

    public function show(Request $request, Quote $quote): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $quote->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $quote->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($quote->load([
            'client', 'site', 'quoteLines.commercialOffering', 'billingAddress', 'deliveryAddress', 'pdfTemplate', 'attachments',
        ]));
    }

    public function update(Request $request, Quote $quote): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $statusRule = Rule::in(Quote::statuses());

        if ($quote->status !== Quote::STATUS_DRAFT) {
            $validated = $request->validate([
                'status' => ['sometimes', $statusRule],
                'notes' => 'nullable|string',
                'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
                'meta' => 'nullable|array',
            ]);
            $quote->fill($validated);
            $quote->save();

            return response()->json($quote->fresh()->load([
                'client', 'site', 'quoteLines.commercialOffering', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
            ]));
        }

        $validated = $request->validate(array_merge([
            'client_id' => 'sometimes|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'quote_date' => 'sometimes|date',
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'status' => ['sometimes', $statusRule],
            'notes' => 'nullable|string',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'apply_site_travel' => 'nullable|boolean',
            'meta' => 'nullable|array',
        ], [
            'lines' => 'sometimes|array|min:1',
            'lines.*.commercial_offering_id' => 'nullable|exists:commercial_offerings,id',
            'lines.*.description' => 'required_with:lines|string|max:500',
            'lines.*.quantity' => 'required_with:lines|integer|min:1',
            'lines.*.unit_price' => 'required_with:lines|numeric|min:0',
            'lines.*.tva_rate' => 'nullable|numeric|min:0|max:100',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
        ]));

        $fill = collect($validated)->except(['lines', 'apply_site_travel'])->toArray();
        if (! empty($validated['apply_site_travel']) && ($validated['site_id'] ?? $quote->site_id)) {
            $sid = $validated['site_id'] ?? $quote->site_id;
            $site = Site::find($sid);
            if ($site) {
                $fill['travel_fee_ht'] = (float) $site->travel_fee_quote_ht;
            }
        }
        $quote->fill($fill);

        if (isset($validated['lines'])) {
            $defaultTva = $validated['tva_rate'] ?? $quote->tva_rate;
            $quote->quoteLines()->delete();
            $this->syncQuoteLines($quote, $validated['lines'], (float) $defaultTva);
        }

        $quote->save();
        $this->recalculateQuoteTotals($quote);

        return response()->json($quote->fresh()->load([
            'client', 'site', 'quoteLines.commercialOffering', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
        ]));
    }

    public function destroy(Request $request, Quote $quote): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $quote->delete();

        return response()->json(null, 204);
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    private function syncQuoteLines(Quote $quote, array $lines, float $defaultTva): void
    {
        foreach ($lines as $line) {
            $tva = isset($line['tva_rate']) ? (float) $line['tva_rate'] : $defaultTva;
            $disc = isset($line['discount_percent']) ? (float) $line['discount_percent'] : 0;
            $ht = CommercialDocumentTotalsService::lineHt(
                (float) $line['quantity'],
                (float) $line['unit_price'],
                $disc,
            );
            QuoteLine::create([
                'quote_id' => $quote->id,
                'commercial_offering_id' => isset($line['commercial_offering_id']) ? (int) $line['commercial_offering_id'] : null,
                'description' => $line['description'],
                'quantity' => (int) $line['quantity'],
                'unit_price' => $line['unit_price'],
                'tva_rate' => $tva,
                'discount_percent' => $disc,
                'total' => $ht,
            ]);
        }
    }

    private function recalculateQuoteTotals(Quote $quote): void
    {
        $quote->load('quoteLines');
        $lines = [];
        foreach ($quote->quoteLines as $ql) {
            $lines[] = [
                'ht' => (float) $ql->total,
                'tva_rate' => (float) $ql->tva_rate,
            ];
        }

        $totals = CommercialDocumentTotalsService::computeTotals(
            $lines,
            (float) $quote->discount_percent,
            (float) $quote->discount_amount,
            (float) $quote->shipping_amount_ht,
            (float) $quote->shipping_tva_rate,
            (float) $quote->travel_fee_ht,
            (float) $quote->travel_fee_tva_rate,
        );

        $quote->update([
            'amount_ht' => $totals['amount_ht'],
            'amount_ttc' => $totals['amount_ttc'],
        ]);
    }
}
