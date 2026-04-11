<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Sample;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Order::query()->with(['client', 'site', 'orderItems.testType', 'orderItems.samples']);

        if ($user->isClient()) {
            $query->where('client_id', $user->client_id);
        } elseif ($user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        $status = $request->query('status');
        if ($status) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', '%'.$search.'%')
                    ->orWhere('notes', 'like', '%'.$search.'%');
            });
        }

        $orders = $query->orderByDesc('created_at')->paginate(15);

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'order_date' => 'required|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.test_type_id' => 'required|exists:test_types,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        if ($user->isClient() && (int) $validated['client_id'] !== (int) $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact()) {
            if ((int) $validated['client_id'] !== (int) $user->client_id) {
                return response()->json(['message' => 'Non autorisé'], 403);
            }
        }

        $order = Order::create([
            'reference' => 'CMD-'.strtoupper(Str::random(8)),
            'client_id' => $validated['client_id'],
            'site_id' => $validated['site_id'] ?? null,
            'user_id' => $user->id,
            'status' => Order::STATUS_DRAFT,
            'order_date' => $validated['order_date'],
            'notes' => $validated['notes'] ?? null,
        ]);

        foreach ($validated['items'] as $item) {
            $orderItem = OrderItem::create([
                'order_id' => $order->id,
                'test_type_id' => $item['test_type_id'],
                'quantity' => $item['quantity'],
            ]);
            for ($i = 0; $i < (int) $item['quantity']; $i++) {
                Sample::create([
                    'order_item_id' => $orderItem->id,
                    'reference' => $order->reference.'-'.($orderItem->id).'-'.($i + 1),
                    'status' => Sample::STATUS_PENDING,
                ]);
            }
        }

        return response()->json($order->load(['client', 'site', 'orderItems.testType', 'orderItems.samples']), 201);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $order->load([
            'client',
            'site',
            'orderItems.testType.params',
            'orderItems.samples.testResults.testTypeParam',
            'reports.pdfTemplate',
            'reports.signedByUser',
            'reports.reviewedByUser',
        ]);

        return response()->json($order);
    }

    public function update(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isLab()) {
            $validated = $request->validate([
                'site_id' => 'nullable|exists:sites,id',
                'order_date' => 'sometimes|date',
                'delivery_date' => 'nullable|date',
                'notes' => 'nullable|string',
                'status' => 'sometimes|in:draft,submitted,in_progress,completed',
                'billing_address_id' => 'nullable|exists:client_addresses,id',
                'delivery_address_id' => 'nullable|exists:client_addresses,id',
                'meta' => 'nullable|array',
            ]);
            $order->update($validated);

            return response()->json($order->load([
                'client', 'site', 'billingAddress', 'deliveryAddress', 'orderItems.testType', 'orderItems.samples',
            ]));
        }

        if ($order->status !== Order::STATUS_DRAFT) {
            return response()->json(['message' => 'Seules les commandes brouillon peuvent être modifiées'], 422);
        }

        $validated = $request->validate([
            'site_id' => 'nullable|exists:sites,id',
            'order_date' => 'sometimes|date',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:draft,submitted',
            'meta' => 'nullable|array',
        ]);

        $order->update($validated);

        return response()->json($order->load(['client', 'site', 'orderItems.testType', 'orderItems.samples']));
    }

    public function destroy(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if (! $user->isLab() && ($order->client_id !== $user->client_id || $order->status !== Order::STATUS_DRAFT)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($order->status !== Order::STATUS_DRAFT && ! $user->isLabAdmin()) {
            return response()->json(['message' => 'Seules les commandes brouillon peuvent être supprimées'], 422);
        }

        $order->delete();

        return response()->json(null, 204);
    }
}
