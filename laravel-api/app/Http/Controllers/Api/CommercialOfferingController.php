<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommercialOffering;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommercialOfferingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $q = CommercialOffering::query()->with('equipment')->orderBy('name');

        if ($request->boolean('active_only', false)) {
            $q->where('active', true);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $q->where(function ($qq) use ($search) {
                $qq->where('name', 'like', '%'.$search.'%')
                    ->orWhere('code', 'like', '%'.$search.'%')
                    ->orWhere('description', 'like', '%'.$search.'%');
            });
        }

        if ($request->filled('kind')) {
            $q->where('kind', $request->query('kind'));
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        return response()->json($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'code' => 'nullable|string|max:64|unique:commercial_offerings,code',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'kind' => ['required', Rule::in([CommercialOffering::KIND_PRODUCT, CommercialOffering::KIND_SERVICE])],
            'unit' => 'nullable|string|max:32',
            'purchase_price_ht' => 'nullable|numeric|min:0',
            'sale_price_ht' => 'nullable|numeric|min:0',
            'default_tva_rate' => 'nullable|numeric|min:0|max:100',
            'stock_quantity' => 'nullable|numeric|min:0',
            'track_stock' => 'nullable|boolean',
            'active' => 'nullable|boolean',
            'equipment_id' => 'nullable|integer|exists:equipments,id',
        ]);

        $row = CommercialOffering::create([
            'code' => $validated['code'] ?? null,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'kind' => $validated['kind'],
            'unit' => $validated['unit'] ?? null,
            'purchase_price_ht' => $validated['purchase_price_ht'] ?? 0,
            'sale_price_ht' => $validated['sale_price_ht'] ?? 0,
            'default_tva_rate' => $validated['default_tva_rate'] ?? 20,
            'stock_quantity' => $validated['stock_quantity'] ?? 0,
            'track_stock' => $validated['track_stock'] ?? false,
            'active' => $validated['active'] ?? true,
            'equipment_id' => $validated['equipment_id'] ?? null,
        ]);

        return response()->json($row->load('equipment'), 201);
    }

    public function show(Request $request, CommercialOffering $commercialOffering): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($commercialOffering->load('equipment'));
    }

    public function update(Request $request, CommercialOffering $commercialOffering): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:64', Rule::unique('commercial_offerings', 'code')->ignore($commercialOffering->id)],
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'kind' => ['sometimes', Rule::in([CommercialOffering::KIND_PRODUCT, CommercialOffering::KIND_SERVICE])],
            'unit' => 'nullable|string|max:32',
            'purchase_price_ht' => 'nullable|numeric|min:0',
            'sale_price_ht' => 'nullable|numeric|min:0',
            'default_tva_rate' => 'nullable|numeric|min:0|max:100',
            'stock_quantity' => 'nullable|numeric|min:0',
            'track_stock' => 'nullable|boolean',
            'active' => 'nullable|boolean',
            'equipment_id' => 'nullable|integer|exists:equipments,id',
        ]);

        $commercialOffering->fill($validated);
        $commercialOffering->save();

        return response()->json($commercialOffering->fresh()->load('equipment'));
    }

    public function destroy(Request $request, CommercialOffering $commercialOffering): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $commercialOffering->delete();

        return response()->json(null, 204);
    }
}
