<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FxRateService;
use App\Support\CurrencyCode;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FxRateController extends Controller
{
    public function __construct(private readonly FxRateService $fxRates) {}

    public function catalog(): JsonResponse
    {
        return response()->json([
            'base_currency' => CurrencyCode::BASE,
            'currencies' => CurrencyCode::catalog(),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => 'required|string|size:3',
            'to' => 'nullable|string|size:3',
            'date' => 'nullable|date',
        ]);

        $from = CurrencyCode::normalize($validated['from']);
        $to = CurrencyCode::normalize($validated['to'] ?? CurrencyCode::BASE);

        try {
            $rate = $this->fxRates->getRate($from, $to, $validated['date'] ?? null);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'from' => $from,
            'to' => $to,
            'rate' => $rate,
            'date' => $validated['date'] ?? now()->toDateString(),
            'label_from' => CurrencyCode::displayLabel($from),
            'label_to' => CurrencyCode::displayLabel($to),
        ]);
    }

    public function settings(): JsonResponse
    {
        return response()->json($this->fxRates->settings());
    }

    public function status(): JsonResponse
    {
        return response()->json($this->fxRates->status());
    }

    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isLabAdmin() && ! $user->hasCapability(PermissionCatalog::CONFIG_MANAGE)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        try {
            return response()->json($this->fxRates->refresh());
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
