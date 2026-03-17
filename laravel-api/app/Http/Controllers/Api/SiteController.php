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
