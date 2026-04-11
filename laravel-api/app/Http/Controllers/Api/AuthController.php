<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Identifiants invalides'], 401);
        }

        $user = Auth::user();
        $user->tokens()->where('name', 'spa')->delete();
        $token = $user->createToken('spa')->plainTextToken;

        $user->load(['client', 'site', 'accessGroups']);
        $payload = $user->toArray();
        $payload['effective_permissions'] = $user->effectivePermissionKeys();

        return response()->json([
            'user' => $payload,
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => 'required|in:client,site_contact',
            'client_id' => 'required_if:role,client,site_contact|nullable|exists:clients,id',
            'site_id' => 'required_if:role,site_contact|nullable|exists:sites,id',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
            'client_id' => $request->client_id,
            'site_id' => $request->site_id,
        ]);

        $token = $user->createToken('spa')->plainTextToken;

        $user->load(['client', 'site', 'accessGroups']);
        $payload = $user->toArray();
        $payload['effective_permissions'] = $user->effectivePermissionKeys();

        return response()->json([
            'user' => $payload,
            'token' => $token,
            'token_type' => 'Bearer',
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie']);
    }

    public function user(Request $request): JsonResponse
    {
        $u = $request->user()->load(['client', 'site', 'accessGroups']);
        $data = $u->toArray();
        $data['effective_permissions'] = $u->effectivePermissionKeys();

        return response()->json($data);
    }
}
