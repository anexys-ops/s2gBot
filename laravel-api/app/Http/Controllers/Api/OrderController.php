<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Sample;
use App\Models\Site;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Order::query()->with(['client', 'site', 'agency', 'orderItems.testType', 'orderItems.samples']);

        if (! $user->isLab()) {
            AgencyAccess::applyOrderScope($query, $user);
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

        $perPage = (int) $request->query('per_page', 15);
        $perPage = min(100, max(1, $perPage));

        $orders = $query->orderByDesc('created_at')->paginate($perPage);

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

        if (($user->isClient() || $user->isSiteContact()) && ! empty($validated['site_id'])) {
            $siteForAccess = Site::query()->find((int) $validated['site_id']);
            if ($siteForAccess && ! AgencyAccess::userMayAccessSite($user, $siteForAccess)) {
                return response()->json(['message' => 'Non autorisé'], 403);
            }
        }

        $agencyId = null;
        if (! empty($validated['site_id'])) {
            $site = Site::query()->find((int) $validated['site_id']);
            if (! $site || (int) $site->client_id !== (int) $validated['client_id']) {
                return response()->json(['message' => 'Chantier invalide pour ce client.'], 422);
            }
            $agencyId = $site->agency_id;
        }
        if (! $agencyId) {
            $agencyId = Agency::query()
                ->where('client_id', $validated['client_id'])
                ->where('is_headquarters', true)
                ->value('id');
        }

        $order = Order::create([
            'reference' => 'CMD-'.strtoupper(Str::random(8)),
            'client_id' => $validated['client_id'],
            'agency_id' => $agencyId,
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

        return response()->json($order->load(['client', 'site', 'agency', 'orderItems.testType', 'orderItems.samples']), 201);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $order->load([
            'client',
            'site',
            'agency',
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
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
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
            $order->refresh();
            if (array_key_exists('site_id', $validated)) {
                $agencyId = null;
                if ($order->site_id) {
                    $agencyId = Site::query()->whereKey($order->site_id)->value('agency_id');
                }
                if (! $agencyId) {
                    $agencyId = Agency::query()->where('client_id', $order->client_id)->where('is_headquarters', true)->value('id');
                }
                if ($agencyId) {
                    $order->update(['agency_id' => $agencyId]);
                }
            }

            return response()->json($order->load([
                'client', 'site', 'agency', 'billingAddress', 'deliveryAddress', 'orderItems.testType', 'orderItems.samples',
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
        $order->refresh();
        if (array_key_exists('site_id', $validated)) {
            $agencyId = null;
            if ($order->site_id) {
                $agencyId = Site::query()->whereKey($order->site_id)->value('agency_id');
            }
            if (! $agencyId) {
                $agencyId = Agency::query()->where('client_id', $order->client_id)->where('is_headquarters', true)->value('id');
            }
            if ($agencyId) {
                $order->update(['agency_id' => $agencyId]);
            }
        }

        return response()->json($order->load(['client', 'site', 'agency', 'orderItems.testType', 'orderItems.samples']));
    }

    public function destroy(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if (! $user->isLab() && (! AgencyAccess::userMayAccessOrder($user, $order) || $order->status !== Order::STATUS_DRAFT)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($order->status !== Order::STATUS_DRAFT && ! $user->isLabAdmin()) {
            return response()->json(['message' => 'Seules les commandes brouillon peuvent être supprimées'], 422);
        }

        $order->delete();

        return response()->json(null, 204);
    }
}
