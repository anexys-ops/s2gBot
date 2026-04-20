<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\Order;
use App\Models\Sample;
use App\Models\TestResult;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TestResultController extends Controller
{
    public function store(Request $request, Sample $sample): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'results' => 'required|array|min:1',
            'results.*.test_type_param_id' => 'required|exists:test_type_params,id',
            'results.*.value' => 'required|string|max:255',
            'results.*.equipment_id' => 'nullable|exists:equipments,id',
        ]);

        $sample->loadMissing('orderItem.order');
        $order = $sample->orderItem->order;
        $testTypeId = (int) $sample->orderItem->test_type_id;

        foreach ($validated['results'] as $r) {
            if (empty($r['equipment_id'])) {
                continue;
            }
            $equipment = Equipment::query()->find((int) $r['equipment_id']);
            if (! $equipment instanceof Equipment) {
                continue;
            }
            if ($order->agency_id !== null && (int) $equipment->agency_id !== (int) $order->agency_id) {
                return response()->json(['message' => 'L’équipement ne correspond pas à l’agence de la commande.'], 422);
            }
            if (! $equipment->testTypes()->where('test_types.id', $testTypeId)->exists()) {
                return response()->json(['message' => 'L’équipement n’est pas rattaché au type d’essai de cette ligne.'], 422);
            }
        }

        $created = [];
        foreach ($validated['results'] as $r) {
            $paramId = $r['test_type_param_id'];
            $exists = $sample->orderItem->testType->params()->where('id', $paramId)->exists();
            if (! $exists) {
                continue;
            }
            $created[] = TestResult::updateOrCreate(
                [
                    'sample_id' => $sample->id,
                    'test_type_param_id' => $paramId,
                ],
                [
                    'value' => $r['value'],
                    'created_by' => $request->user()->id,
                    'equipment_id' => $r['equipment_id'] ?? null,
                ]
            );
        }

        $sample->update(['status' => Sample::STATUS_TESTED]);

        return response()->json($sample->load(['testResults.testTypeParam', 'testResults.equipment']), 201);
    }

    public function byOrder(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $samples = Sample::query()
            ->whereHas('orderItem', fn ($q) => $q->where('order_id', $order->id))
            ->with(['orderItem.testType', 'testResults.testTypeParam', 'testResults.createdBy', 'testResults.equipment'])
            ->get();

        return response()->json($samples);
    }
}
