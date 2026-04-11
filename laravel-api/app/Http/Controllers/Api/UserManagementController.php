<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeUsers($request);

        $q = User::query()->with(['client', 'site', 'accessGroups'])->orderBy('name');

        if ($search = trim((string) $request->query('search', ''))) {
            $q->where(function ($qq) use ($search) {
                $qq->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%');
            });
        }

        return response()->json($q->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeUsers($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', Password::defaults()],
            'phone' => 'nullable|string|max:40',
            'role' => ['required', Rule::in([
                User::ROLE_LAB_ADMIN,
                User::ROLE_LAB_TECHNICIAN,
                User::ROLE_CLIENT,
                User::ROLE_SITE_CONTACT,
            ])],
            'client_id' => 'nullable|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'access_group_ids' => 'nullable|array',
            'access_group_ids.*' => 'integer|exists:access_groups,id',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
            'role' => $validated['role'],
            'client_id' => $validated['client_id'] ?? null,
            'site_id' => $validated['site_id'] ?? null,
        ]);

        if (! empty($validated['access_group_ids'])) {
            $user->accessGroups()->sync($validated['access_group_ids']);
        }

        return response()->json($user->fresh()->load(['client', 'site', 'accessGroups']), 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeUsers($request);

        return response()->json($user->load(['client', 'site', 'accessGroups']));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeUsers($request);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', Password::defaults()],
            'phone' => 'nullable|string|max:40',
            'role' => ['sometimes', Rule::in([
                User::ROLE_LAB_ADMIN,
                User::ROLE_LAB_TECHNICIAN,
                User::ROLE_CLIENT,
                User::ROLE_SITE_CONTACT,
            ])],
            'client_id' => 'nullable|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'access_group_ids' => 'nullable|array',
            'access_group_ids.*' => 'integer|exists:access_groups,id',
        ]);

        if (isset($validated['password']) && $validated['password'] !== null && $validated['password'] !== '') {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        if (array_key_exists('access_group_ids', $validated)) {
            $user->accessGroups()->sync($validated['access_group_ids'] ?? []);
            unset($validated['access_group_ids']);
        }

        $user->fill($validated);
        $user->save();

        return response()->json($user->fresh()->load(['client', 'site', 'accessGroups']));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorizeUsers($request);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }

        $user->delete();

        return response()->json(null, 204);
    }

    private function authorizeUsers(Request $request): void
    {
        $u = $request->user();
        abort_unless(
            $u->isLabAdmin() || $u->hasCapability(PermissionCatalog::USERS_MANAGE),
            403,
            'Non autorisé'
        );
    }
}
