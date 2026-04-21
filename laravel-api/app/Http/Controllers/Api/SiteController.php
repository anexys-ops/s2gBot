<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Site;
use App\Support\AgencyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SiteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Site::query()->with(['client', 'agency']);

        if (! $user->isLab()) {
            AgencyAccess::applySiteScope($query, $user);
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
            'agency_id' => 'nullable|exists:agencies,id',
            'name' => 'required|string|max:255',
            'address' => 'nullable|string',
            'reference' => 'nullable|string|max:100',
            'status' => ['nullable', 'string', Rule::in(Site::STATUSES)],
            'travel_fee_quote_ht' => 'nullable|numeric|min:0',
            'travel_fee_invoice_ht' => 'nullable|numeric|min:0',
            'travel_fee_label' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'meta' => 'nullable|array',
        ]);

        if (! isset($validated['status']) || $validated['status'] === '') {
            $validated['status'] = 'not_started';
        }

        $clientId = (int) $validated['client_id'];
        $agencyId = isset($validated['agency_id']) ? (int) $validated['agency_id'] : null;
        if ($agencyId) {
            $ok = Agency::query()->whereKey($agencyId)->where('client_id', $clientId)->exists();
            if (! $ok) {
                return response()->json(['message' => 'Agence invalide pour ce client.'], 422);
            }
        } else {
            $agencyId = (int) Agency::query()->where('client_id', $clientId)->where('is_headquarters', true)->value('id');
        }

        $site = Site::create(array_merge($validated, ['agency_id' => $agencyId]));

        return response()->json($site->load(['client', 'agency']), 201);
    }

    public function show(Request $request, Site $site): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessSite($user, $site)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($site->load(['client', 'agency']));
    }

    public function update(Request $request, Site $site): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'client_id' => 'sometimes|exists:clients,id',
            'agency_id' => 'nullable|exists:agencies,id',
            'name' => 'sometimes|string|max:255',
            'address' => 'nullable|string',
            'reference' => 'nullable|string|max:100',
            'status' => ['sometimes', 'nullable', 'string', Rule::in(Site::STATUSES)],
            'travel_fee_quote_ht' => 'nullable|numeric|min:0',
            'travel_fee_invoice_ht' => 'nullable|numeric|min:0',
            'travel_fee_label' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'meta' => 'nullable|array',
        ]);

        if (isset($validated['agency_id']) && $validated['agency_id'] !== null) {
            $cid = (int) ($validated['client_id'] ?? $site->client_id);
            $ok = Agency::query()->whereKey((int) $validated['agency_id'])->where('client_id', $cid)->exists();
            if (! $ok) {
                return response()->json(['message' => 'Agence invalide pour ce client.'], 422);
            }
        }

        $site->update($validated);

        return response()->json($site->load(['client', 'agency']));
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
