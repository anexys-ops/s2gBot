<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TestType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TestTypeController extends Controller
{
    public function index(): JsonResponse
    {
        $types = TestType::with('params')->orderBy('name')->get();

        return response()->json($types);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'norm' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:50',
            'unit_price' => 'required|numeric|min:0',
            'thresholds' => 'nullable|array',
            'params' => 'nullable|array',
            'params.*.name' => 'required|string|max:255',
            'params.*.unit' => 'nullable|string|max:50',
            'params.*.expected_type' => 'nullable|in:numeric,text,date',
        ]);

        $params = $validated['params'] ?? [];
        unset($validated['params']);

        $testType = TestType::create($validated);

        foreach ($params as $p) {
            $testType->params()->create([
                'name' => $p['name'],
                'unit' => $p['unit'] ?? null,
                'expected_type' => $p['expected_type'] ?? 'numeric',
            ]);
        }

        return response()->json($testType->load('params'), 201);
    }

    public function show(TestType $testType): JsonResponse
    {
        return response()->json($testType->load('params'));
    }

    public function update(Request $request, TestType $testType): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'norm' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:50',
            'unit_price' => 'sometimes|numeric|min:0',
            'thresholds' => 'nullable|array',
        ]);

        $testType->update($validated);

        return response()->json($testType->load('params'));
    }

    public function destroy(Request $request, TestType $testType): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $testType->delete();

        return response()->json(null, 204);
    }
}
