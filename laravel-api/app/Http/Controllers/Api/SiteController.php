<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Site::query()->with('client');

        if ($user->isClient()) {
            $query->where('client_id', $user->client_id);
        } elseif ($user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('reference', 'like', '%'.$search.'%')
                    ->orWhere('address', 'like', '%'.$search.'%');
            });
        }

        $sites = $query->orderBy('name')->get();

        return response()->json($sites);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'name' => 'required|string|max:255',
            'address' => 'nullable|string',
            'reference' => 'nullable|string|max:100',
            'travel_fee_quote_ht' => 'nullable|numeric|min:0',
            'travel_fee_invoice_ht' => 'nullable|numeric|min:0',
            'travel_fee_label' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'meta' => 'nullable|array',
        ]);

        $site = Site::create($validated);

        return response()->json($site->load('client'), 201);
    }

    public function show(Request $request, Site $site): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $site->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $site->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($site->load('client'));
    }

    public function update(Request $request, Site $site): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'client_id' => 'sometimes|exists:clients,id',
            'name' => 'sometimes|string|max:255',
            'address' => 'nullable|string',
            'reference' => 'nullable|string|max:100',
            'travel_fee_quote_ht' => 'nullable|numeric|min:0',
            'travel_fee_invoice_ht' => 'nullable|numeric|min:0',
            'travel_fee_label' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'meta' => 'nullable|array',
        ]);

        $site->update($validated);

        return response()->json($site->load('client'));
    }

    public function destroy(Request $request, Site $site): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $site->delete();

        return response()->json(null, 204);
    }
}
