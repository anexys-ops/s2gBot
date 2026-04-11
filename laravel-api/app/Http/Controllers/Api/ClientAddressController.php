<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientAddressController extends Controller
{
    public function index(Request $request, Client $client): JsonResponse
    {
        $user = $request->user();
        if (($user->isClient() || $user->isSiteContact()) && $client->id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($client->addresses()->orderBy('type')->orderBy('label')->get());
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'type' => ['required', Rule::in([
                ClientAddress::TYPE_BILLING,
                ClientAddress::TYPE_DELIVERY,
                ClientAddress::TYPE_SITE,
                ClientAddress::TYPE_HEADQUARTERS,
            ])],
            'label' => 'nullable|string|max:255',
            'line1' => 'required|string|max:255',
            'line2' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:32',
            'city' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:8',
            'is_default' => 'nullable|boolean',
        ]);

        if (! empty($validated['is_default'])) {
            $client->addresses()->where('type', $validated['type'])->update(['is_default' => false]);
        }

        $address = $client->addresses()->create($validated);

        return response()->json($address, 201);
    }

    public function update(Request $request, ClientAddress $clientAddress): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'type' => ['sometimes', Rule::in([
                ClientAddress::TYPE_BILLING,
                ClientAddress::TYPE_DELIVERY,
                ClientAddress::TYPE_SITE,
                ClientAddress::TYPE_HEADQUARTERS,
            ])],
            'label' => 'nullable|string|max:255',
            'line1' => 'sometimes|string|max:255',
            'line2' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:32',
            'city' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:8',
            'is_default' => 'nullable|boolean',
        ]);

        if (! empty($validated['is_default'])) {
            ClientAddress::query()
                ->where('client_id', $clientAddress->client_id)
                ->where('type', $validated['type'] ?? $clientAddress->type)
                ->where('id', '!=', $clientAddress->id)
                ->update(['is_default' => false]);
        }

        $clientAddress->update($validated);

        return response()->json($clientAddress->fresh());
    }

    public function destroy(Request $request, ClientAddress $clientAddress): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $clientAddress->delete();

        return response()->json(null, 204);
    }
}
