<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Sample;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SampleController extends Controller
{
    public function index(Request $request, Order $order): JsonResponse
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
            ->with(['orderItem.testType', 'testResults.testTypeParam'])
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
            'reference' => 'required|string|max:255|unique:samples,reference',
            'notes' => 'nullable|string',
        ]);

        $sample = Sample::create([
            'order_item_id' => $validated['order_item_id'],
            'reference' => $validated['reference'],
            'status' => Sample::STATUS_PENDING,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json($sample->load('orderItem.testType'), 201);
    }

    public function show(Request $request, Sample $sample): JsonResponse
    {
        $order = $sample->orderItem->order;
        $user = $request->user();
        if ($user->isClient() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $sample->load(['orderItem.testType.params', 'testResults.testTypeParam']);

        return response()->json($sample);
    }

    public function update(Request $request, Sample $sample): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'reference' => 'sometimes|string|max:255|unique:samples,reference,'.$sample->id,
            'received_at' => 'nullable|date',
            'status' => 'sometimes|in:pending,received,in_progress,tested,validated',
            'notes' => 'nullable|string',
        ]);

        $sample->update($validated);

        return response()->json($sample->load('orderItem.testType'));
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
