<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Client;
use App\Models\Site;
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
            'device_name' => 'nullable|string|max:255',
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Identifiants invalides'], 401);
        }

        $user = Auth::user();
        $device = $request->input('device_name');
        $tokenName = is_string($device) && trim($device) !== '' ? trim($device) : 'spa';
        $user->tokens()->where('name', $tokenName)->delete();
        $token = $user->createToken($tokenName)->plainTextToken;

        $user->load(['client', 'site', 'accessGroups', 'agencies']);
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

        if ($user->site_id) {
            $site = Site::query()->find($user->site_id);
            if ($site && $site->agency_id) {
                $user->agencies()->sync([$site->agency_id]);
            }
        }

        $token = $user->createToken('spa')->plainTextToken;

        $user->load(['client', 'site', 'accessGroups', 'agencies']);
        $payload = $user->toArray();
        $payload['effective_permissions'] = $user->effectivePermissionKeys();

        return response()->json([
            'user' => $payload,
            'token' => $token,
            'token_type' => 'Bearer',
        ], 201);
    }

    /**
     * Liste minimale des clients pour le formulaire d'inscription (sans authentification).
     */
    public function registerClientList(): JsonResponse
    {
        $clients = Client::query()->orderBy('name')->get(['id', 'name']);

        return response()->json($clients);
    }

    /**
     * Chantiers d'un client pour l'inscription « contact chantier » (sans authentification).
     */
    public function registerSiteList(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|integer|exists:clients,id',
        ]);

        $sites = Site::query()
            ->where('client_id', $validated['client_id'])
            ->orderBy('name')
            ->get(['id', 'name', 'client_id']);

        return response()->json($sites);
    }

    /**
     * Agences d'un client (inscription / choix tenant).
     */
    public function registerAgencyList(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|integer|exists:clients,id',
        ]);

        $agencies = Agency::query()
            ->where('client_id', $validated['client_id'])
            ->orderByDesc('is_headquarters')
            ->orderBy('name')
            ->get(['id', 'name', 'client_id', 'is_headquarters', 'code']);

        return response()->json($agencies);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie']);
    }

    public function user(Request $request): JsonResponse
    {
        $u = $request->user()->load(['client', 'site', 'accessGroups', 'agencies']);
        $data = $u->toArray();
        $data['effective_permissions'] = $u->effectivePermissionKeys();

        return response()->json($data);
    }
}
