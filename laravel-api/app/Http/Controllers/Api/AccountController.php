<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;

class AccountController extends Controller
{
    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users')->ignore($request->user()->id)],
            'phone' => 'nullable|string|max:40',
        ]);

        $request->user()->fill($validated);
        $request->user()->save();

        return response()->json($this->serializeUser($request->user()->fresh()->load(['client', 'site', 'accessGroups'])));
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        if (! Hash::check($validated['current_password'], $request->user()->password)) {
            return response()->json(['message' => 'Mot de passe actuel incorrect.'], 422);
        }

        $request->user()->update([
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json(['message' => 'Mot de passe mis à jour.']);
    }

    public function listApiTokens(Request $request): JsonResponse
    {
        $rows = $request->user()->tokens()->orderByDesc('created_at')->get()->map(function ($t) {
            return [
                'id' => $t->id,
                'name' => $t->name,
                'last_used_at' => $t->last_used_at?->toIso8601String(),
                'created_at' => $t->created_at->toIso8601String(),
                'is_spa' => $t->name === 'spa',
            ];
        });

        return response()->json(['data' => $rows]);
    }

    public function createApiToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80', 'regex:/^[a-zA-Z0-9._\- ]+$/'],
        ]);

        if (strtolower($validated['name']) === 'spa') {
            return response()->json(['message' => 'Le nom « spa » est réservé pour la session navigateur.'], 422);
        }

        $token = $request->user()->createToken($validated['name']);

        return response()->json([
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'name' => $validated['name'],
            'message' => 'Copiez ce jeton maintenant : il ne sera plus affiché en clair.',
        ], 201);
    }

    public function revokeApiToken(Request $request, int $tokenId): JsonResponse
    {
        $token = PersonalAccessToken::query()
            ->where('id', $tokenId)
            ->where('tokenable_id', $request->user()->id)
            ->where('tokenable_type', $request->user()->getMorphClass())
            ->firstOrFail();

        if ($token->name === 'spa') {
            return response()->json(['message' => 'Impossible de révoquer le jeton de session web (spa). Déconnectez-vous à la place.'], 422);
        }

        $token->delete();

        return response()->json(null, 204);
    }

    public function permissionCatalog(): JsonResponse
    {
        return response()->json([
            'permissions' => PermissionCatalog::labels(),
        ]);
    }

    private function serializeUser(\App\Models\User $u): array
    {
        $data = $u->toArray();
        $data['effective_permissions'] = $u->effectivePermissionKeys();

        return $data;
    }
}
