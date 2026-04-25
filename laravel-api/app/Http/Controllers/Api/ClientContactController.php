<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientContactController extends Controller
{
    private const CONTACT_TYPES = 'facturation,livraison,technique,chantier,commercial,autre';

    public function all(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = ClientContact::query()->with('client:id,name,email,phone,city');

        if ($user->isClient() || $user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('prenom', 'like', '%'.$search.'%')
                    ->orWhere('contact_type', 'like', '%'.$search.'%')
                    ->orWhere('nom', 'like', '%'.$search.'%')
                    ->orWhere('poste', 'like', '%'.$search.'%')
                    ->orWhere('departement', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('telephone_direct', 'like', '%'.$search.'%')
                    ->orWhere('telephone_mobile', 'like', '%'.$search.'%')
                    ->orWhereHas('client', function ($clientQuery) use ($search) {
                        $clientQuery->where('name', 'like', '%'.$search.'%');
                    });
            });
        }

        return response()->json(
            $query
                ->orderBy('client_id')
                ->orderByDesc('is_principal')
                ->orderBy('nom')
                ->orderBy('prenom')
                ->get(),
        );
    }

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
            'contact_type' => 'nullable|in:'.self::CONTACT_TYPES,
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
        $validated['contact_type'] = $validated['contact_type'] ?? 'commercial';

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
            'contact_type' => 'sometimes|nullable|in:'.self::CONTACT_TYPES,
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
        if (array_key_exists('contact_type', $validated) && $validated['contact_type'] === null) {
            $validated['contact_type'] = 'commercial';
        }

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
