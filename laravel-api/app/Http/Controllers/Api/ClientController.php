<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Client::query()->with('sites');

        if ($user->isClient()) {
            $query->where('id', $user->client_id);
        } elseif ($user->isSiteContact()) {
            $query->where('id', $user->client_id);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('phone', 'like', '%'.$search.'%')
                    ->orWhere('whatsapp', 'like', '%'.$search.'%')
                    ->orWhere('siret', 'like', '%'.$search.'%')
                    ->orWhere('ice', 'like', '%'.$search.'%')
                    ->orWhere('rc', 'like', '%'.$search.'%')
                    ->orWhere('city', 'like', '%'.$search.'%');
            });
        }

        $clients = $query->orderBy('name')->get();

        return response()->json($clients);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:128',
            'postal_code' => 'nullable|string|max:16',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:50',
            'whatsapp' => 'nullable|string|max:50',
            'siret' => 'nullable|string|max:20',
            'ice' => 'nullable|string|max:32',
            'rc' => 'nullable|string|max:80',
            'patente' => 'nullable|string|max:64',
            'if_number' => 'nullable|string|max:32',
            'legal_form' => 'nullable|string|max:64',
            'cnss_employer' => 'nullable|string|max:32',
            'capital_social' => 'nullable|numeric|min:0',
            'meta' => 'nullable|array',
        ]);

        $client = Client::create($validated);

        return response()->json($client->load('sites'), 201);
    }

    public function show(Request $request, Client $client): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $client->id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $client->id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($client->load(['sites.agency', 'agencies']));
    }

    public function update(Request $request, Client $client): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:128',
            'postal_code' => 'nullable|string|max:16',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:50',
            'whatsapp' => 'nullable|string|max:50',
            'siret' => 'nullable|string|max:20',
            'ice' => 'nullable|string|max:32',
            'rc' => 'nullable|string|max:80',
            'patente' => 'nullable|string|max:64',
            'if_number' => 'nullable|string|max:32',
            'legal_form' => 'nullable|string|max:64',
            'cnss_employer' => 'nullable|string|max:32',
            'capital_social' => 'nullable|numeric|min:0',
            'meta' => 'nullable|array',
        ]);

        $client->update($validated);

        return response()->json($client->load('sites'));
    }

    public function destroy(Request $request, Client $client): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $client->delete();

        return response()->json(null, 204);
    }
}
