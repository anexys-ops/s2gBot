<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientContactController extends Controller
{
    public function index(Request $request, Client $client): JsonResponse
    {
        $user = $request->user();
        if (($user->isClient() || $user->isSiteContact()) && $client->id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(
            $client->contacts()->orderByDesc('is_principal')->orderBy('nom')->orderBy('prenom')->get(),
        );
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'prenom' => 'required|string|max:128',
            'nom' => 'required|string|max:128',
            'poste' => 'nullable|string|max:128',
            'departement' => 'nullable|string|max:128',
            'email' => 'nullable|email|max:255',
            'telephone_direct' => 'nullable|string|max:64',
            'telephone_mobile' => 'nullable|string|max:64',
            'is_principal' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        if (! empty($validated['is_principal'])) {
            $client->contacts()->update(['is_principal' => false]);
        }

        $contact = $client->contacts()->create($validated);

        return response()->json($contact, 201);
    }

    public function update(Request $request, ClientContact $clientContact): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'prenom' => 'sometimes|string|max:128',
            'nom' => 'sometimes|string|max:128',
            'poste' => 'nullable|string|max:128',
            'departement' => 'nullable|string|max:128',
            'email' => 'nullable|email|max:255',
            'telephone_direct' => 'nullable|string|max:64',
            'telephone_mobile' => 'nullable|string|max:64',
            'is_principal' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        if (! empty($validated['is_principal'])) {
            ClientContact::query()
                ->where('client_id', $clientContact->client_id)
                ->whereKeyNot($clientContact->id)
                ->update(['is_principal' => false]);
        }

        $clientContact->update($validated);

        return response()->json($clientContact->fresh());
    }

    public function destroy(Request $request, ClientContact $clientContact): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $clientContact->delete();

        return response()->json(null, 204);
    }
}
