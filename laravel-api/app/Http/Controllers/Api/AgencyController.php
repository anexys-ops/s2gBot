<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Client;
use App\Models\User;
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

    // ── Standalone agences (v1.2.0 — système multi-agences labo) ────────────

    /**
     * Liste paginée des agences labo (indépendant du client).
     */
    public function indexStandalone(Request $request): JsonResponse
    {
        $query = Agency::withCount('users');

        if ($request->boolean('active')) {
            $query->where('active', true);
        }

        return response()->json(
            $query->orderByDesc('is_siege')->orderBy('name')
                ->paginate((int) $request->query('per_page', 50))
        );
    }

    /**
     * Crée une agence labo standalone.
     */
    public function storeStandalone(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'code'     => 'required|string|max:64|unique:agencies,code',
            'address'  => 'nullable|string',
            'city'     => 'nullable|string|max:128',
            'phone'    => 'nullable|string|max:50',
            'email'    => 'nullable|email|max:255',
            'is_siege' => 'sometimes|boolean',
            'active'   => 'sometimes|boolean',
        ]);

        $agency = Agency::create($validated);

        return response()->json($agency->loadCount('users'), 201);
    }

    /**
     * Affiche une agence labo avec le nombre d'utilisateurs.
     */
    public function showStandalone(int $id): JsonResponse
    {
        $agency = Agency::withCount('users')->findOrFail($id);

        return response()->json($agency);
    }

    /**
     * Met à jour une agence labo standalone.
     */
    public function updateStandalone(Request $request, int $id): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $agency = Agency::findOrFail($id);

        $validated = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'code'     => 'sometimes|string|max:64|unique:agencies,code,'.$agency->id,
            'address'  => 'nullable|string',
            'city'     => 'nullable|string|max:128',
            'phone'    => 'nullable|string|max:50',
            'email'    => 'nullable|email|max:255',
            'is_siege' => 'sometimes|boolean',
            'active'   => 'sometimes|boolean',
        ]);

        $agency->update($validated);

        return response()->json($agency->fresh()->loadCount('users'));
    }

    /**
     * Supprime une agence labo (interdit si is_siege).
     */
    public function destroyStandalone(Request $request, int $id): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $agency = Agency::findOrFail($id);

        if ($agency->is_siege) {
            return response()->json(['message' => 'Impossible de supprimer l\'agence siège.'], 422);
        }

        $agency->delete();

        return response()->json(null, 204);
    }

    /**
     * Assigne un utilisateur à cette agence (met à jour users.agency_id).
     */
    public function assignUser(Request $request, int $id): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $agency = Agency::findOrFail($id);

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $user = User::findOrFail($validated['user_id']);
        $user->update(['agency_id' => $agency->id]);

        return response()->json(['message' => 'Utilisateur assigné.', 'user' => $user->fresh()]);
    }

    /**
     * Liste les utilisateurs d'une agence.
     */
    public function agencyUsers(int $id): JsonResponse
    {
        $agency = Agency::findOrFail($id);

        $users = User::where('agency_id', $agency->id)
            ->select(['id', 'name', 'email', 'role', 'phone', 'agency_id'])
            ->orderBy('name')
            ->get();

        return response()->json($users);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

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
