<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TestType;
use App\Models\TestTypeParam;
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
        if (! $request->user()->isLab()) {
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
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'norm' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:50',
            'unit_price' => 'sometimes|numeric|min:0',
            'thresholds' => 'nullable|array',
            'params' => 'sometimes|array',
            'params.*.id' => 'nullable|integer|exists:test_type_params,id',
            'params.*.name' => 'required|string|max:255',
            'params.*.unit' => 'nullable|string|max:50',
            'params.*.expected_type' => 'nullable|in:numeric,text,date',
        ]);

        $paramsPayload = null;
        if (array_key_exists('params', $validated)) {
            $paramsPayload = $validated['params'];
            unset($validated['params']);
        }

        if ($validated !== []) {
            $testType->update($validated);
        }

        if ($paramsPayload !== null) {
            $incomingIds = collect($paramsPayload)->pluck('id')->filter()->values();
            foreach ($incomingIds as $paramId) {
                $ok = TestTypeParam::query()
                    ->where('id', $paramId)
                    ->where('test_type_id', $testType->id)
                    ->exists();
                if (! $ok) {
                    return response()->json(['message' => 'Paramètre invalide pour ce type d’essai.'], 422);
                }
            }

            $keepIds = $incomingIds->all();
            $testType->load('params');
            foreach ($testType->params as $param) {
                if (in_array($param->id, $keepIds, true)) {
                    continue;
                }
                if ($param->testResults()->exists()) {
                    return response()->json([
                        'message' => 'Impossible de retirer le paramètre « '.$param->name.' » : des mesures y sont liées.',
                    ], 422);
                }
                $param->delete();
            }

            foreach ($paramsPayload as $p) {
                if (! empty($p['id'])) {
                    TestTypeParam::query()
                        ->where('id', $p['id'])
                        ->where('test_type_id', $testType->id)
                        ->update([
                            'name' => $p['name'],
                            'unit' => $p['unit'] ?? null,
                            'expected_type' => $p['expected_type'] ?? 'numeric',
                        ]);
                } else {
                    $testType->params()->create([
                        'name' => $p['name'],
                        'unit' => $p['unit'] ?? null,
                        'expected_type' => $p['expected_type'] ?? 'numeric',
                    ]);
                }
            }
        }

        return response()->json($testType->fresh()->load('params'));
    }

    public function destroy(Request $request, TestType $testType): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($testType->orderItems()->exists()) {
            return response()->json([
                'message' => 'Ce type d’essai est utilisé sur des commandes : il ne peut pas être supprimé.',
            ], 422);
        }

        $testType->delete();

        return response()->json(null, 204);
    }
}
