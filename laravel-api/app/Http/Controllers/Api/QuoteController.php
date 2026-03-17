<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quote;
use App\Models\QuoteLine;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Quote::query()->with(['client', 'site', 'quoteLines']);

        if ($user->isClient() || $user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        $quotes = $query->orderByDesc('quote_date')->paginate(15);

        return response()->json($quotes);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'quote_date' => 'required|date',
            'valid_until' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.description' => 'required|string|max:500',
            'lines.*.quantity' => 'required|integer|min:1',
            'lines.*.unit_price' => 'required|numeric|min:0',
        ]);

        $number = 'DEV-'.Carbon::now()->format('Ymd').'-'.str_pad((string) (Quote::count() + 1), 4, '0', STR_PAD_LEFT);
        $tvaRate = $validated['tva_rate'] ?? 20;
        $amountHt = 0;

        $quote = Quote::create([
            'number' => $number,
            'client_id' => $validated['client_id'],
            'site_id' => $validated['site_id'] ?? null,
            'quote_date' => $validated['quote_date'],
            'valid_until' => $validated['valid_until'] ?? null,
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => $tvaRate,
            'status' => Quote::STATUS_DRAFT,
            'notes' => $validated['notes'] ?? null,
        ]);

        foreach ($validated['lines'] as $line) {
            $total = round($line['quantity'] * $line['unit_price'], 2);
            $amountHt += $total;
            QuoteLine::create([
                'quote_id' => $quote->id,
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'total' => $total,
            ]);
        }

        $quote->update([
            'amount_ht' => round($amountHt, 2),
            'amount_ttc' => round($amountHt * (1 + $tvaRate / 100), 2),
        ]);

        return response()->json($quote->load(['client', 'site', 'quoteLines']), 201);
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

        return response()->json($quote->load(['client', 'site', 'quoteLines']));
    }

    public function update(Request $request, Quote $quote): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($quote->status !== Quote::STATUS_DRAFT) {
            return response()->json(['message' => 'Seuls les devis brouillon peuvent être modifiés'], 422);
        }

        $validated = $request->validate([
            'client_id' => 'sometimes|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'quote_date' => 'sometimes|date',
            'valid_until' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'status' => 'sometimes|in:draft,sent,accepted,rejected',
            'notes' => 'nullable|string',
            'lines' => 'sometimes|array|min:1',
            'lines.*.description' => 'required_with:lines|string|max:500',
            'lines.*.quantity' => 'required_with:lines|integer|min:1',
            'lines.*.unit_price' => 'required_with:lines|numeric|min:0',
        ]);

        $quote->fill($validated);

        if (isset($validated['lines'])) {
            $quote->quoteLines()->delete();
            $tvaRate = $validated['tva_rate'] ?? $quote->tva_rate;
            $amountHt = 0;
            foreach ($validated['lines'] as $line) {
                $total = round($line['quantity'] * $line['unit_price'], 2);
                $amountHt += $total;
                QuoteLine::create([
                    'quote_id' => $quote->id,
                    'description' => $line['description'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'total' => $total,
                ]);
            }
            $quote->amount_ht = round($amountHt, 2);
            $quote->amount_ttc = round($amountHt * (1 + $tvaRate / 100), 2);
        }

        $quote->save();

        return response()->json($quote->load(['client', 'site', 'quoteLines']));
    }

    public function destroy(Request $request, Quote $quote): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $quote->delete();

        return response()->json(null, 204);
    }
}
