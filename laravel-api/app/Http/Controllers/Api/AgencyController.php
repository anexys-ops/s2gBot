<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgencyController extends Controller
{
    public function index(Request $request, Client $client): JsonResponse
    {
        if (! $this->userMayViewClient($request, $client)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $agencies = $client->agencies()->orderByDesc('is_headquarters')->orderBy('name')->get();

        return response()->json($agencies);
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:64',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:128',
            'postal_code' => 'nullable|string|max:16',
            'is_headquarters' => 'sometimes|boolean',
        ]);

        if (! empty($validated['is_headquarters'])) {
            $client->agencies()->update(['is_headquarters' => false]);
        }

        $agency = $client->agencies()->create($validated);

        return response()->json($agency, 201);
    }

    public function show(Request $request, Agency $agency): JsonResponse
    {
        if (! $this->userMayViewAgency($request, $agency)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($agency->load('client'));
    }

    public function update(Request $request, Agency $agency): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:64',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:128',
            'postal_code' => 'nullable|string|max:16',
            'is_headquarters' => 'sometimes|boolean',
        ]);

        if (! empty($validated['is_headquarters'])) {
            Agency::query()
                ->where('client_id', $agency->client_id)
                ->where('id', '!=', $agency->id)
                ->update(['is_headquarters' => false]);
        }

        $agency->update($validated);

        return response()->json($agency->fresh()->load('client'));
    }

    public function destroy(Request $request, Agency $agency): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($agency->is_headquarters) {
            return response()->json(['message' => 'Impossible de supprimer l’agence siège.'], 422);
        }

        if ($agency->sites()->exists() || $agency->orders()->exists()) {
            return response()->json(['message' => 'Déplacez les chantiers et commandes avant suppression.'], 422);
        }

        $agency->delete();

        return response()->json(null, 204);
    }

    private function userMayViewClient(Request $request, Client $client): bool
    {
        $u = $request->user();

        return $u->isLab() || (int) $u->client_id === (int) $client->id;
    }

    private function userMayViewAgency(Request $request, Agency $agency): bool
    {
        $u = $request->user();

        return $u->isLab() || (int) $u->client_id === (int) $agency->client_id;
    }
}
