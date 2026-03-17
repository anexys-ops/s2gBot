<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Sample;
use App\Models\TestResult;
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
        ]);

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
                ]
            );
        }

        $sample->update(['status' => Sample::STATUS_TESTED]);

        return response()->json($sample->load(['testResults.testTypeParam']), 201);
    }

    public function byOrder(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $samples = Sample::query()
            ->whereHas('orderItem', fn ($q) => $q->where('order_id', $order->id))
            ->with(['orderItem.testType', 'testResults.testTypeParam', 'testResults.createdBy'])
            ->get();

        return response()->json($samples);
    }
}
