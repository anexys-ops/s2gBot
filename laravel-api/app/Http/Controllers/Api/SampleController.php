<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Sample;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SampleController extends Controller
{
    public function index(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $samples = Sample::query()
            ->whereHas('orderItem', fn ($q) => $q->where('order_id', $order->id))
            ->with(['orderItem.testType', 'borehole', 'testResults.testTypeParam'])
            ->get();

        return response()->json($samples);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'order_item_id' => 'required|exists:order_items,id',
            'borehole_id' => 'nullable|exists:boreholes,id',
            'reference' => 'required|string|max:255|unique:samples,reference',
            'notes' => 'nullable|string',
            'depth_top_m' => 'nullable|numeric|min:0',
            'depth_bottom_m' => 'nullable|numeric|min:0',
        ]);

        $sample = Sample::create([
            'order_item_id' => $validated['order_item_id'],
            'borehole_id' => $validated['borehole_id'] ?? null,
            'reference' => $validated['reference'],
            'status' => Sample::STATUS_PENDING,
            'notes' => $validated['notes'] ?? null,
            'depth_top_m' => $validated['depth_top_m'] ?? null,
            'depth_bottom_m' => $validated['depth_bottom_m'] ?? null,
        ]);

        return response()->json($sample->load(['orderItem.testType', 'borehole']), 201);
    }

    public function show(Request $request, Sample $sample): JsonResponse
    {
        $order = $sample->orderItem->order;
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $sample->load(['orderItem.testType.params', 'borehole', 'testResults.testTypeParam']);

        return response()->json($sample);
    }

    public function update(Request $request, Sample $sample): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'reference' => 'sometimes|string|max:255|unique:samples,reference,'.$sample->id,
            'borehole_id' => 'nullable|exists:boreholes,id',
            'received_at' => 'nullable|date',
            'status' => 'sometimes|in:pending,received,in_progress,tested,validated',
            'notes' => 'nullable|string',
            'depth_top_m' => 'nullable|numeric|min:0',
            'depth_bottom_m' => 'nullable|numeric|min:0',
        ]);

        $sample->update($validated);

        return response()->json($sample->load(['orderItem.testType', 'borehole']));
    }

    public function destroy(Request $request, Sample $sample): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $sample->delete();

        return response()->json(null, 204);
    }
}
