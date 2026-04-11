<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccessGroup;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccessGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeGroups($request);

        $rows = AccessGroup::query()->withCount('users')->orderBy('name')->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeGroups($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:80|regex:/^[a-z0-9\-]+$/|unique:access_groups,slug',
            'description' => 'nullable|string|max:500',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string',
        ]);

        $validated['permissions'] = PermissionCatalog::sanitize($validated['permissions'] ?? []);

        $group = AccessGroup::create($validated);

        return response()->json($group->fresh(), 201);
    }

    public function show(Request $request, AccessGroup $accessGroup): JsonResponse
    {
        $this->authorizeGroups($request);

        return response()->json($accessGroup->load(['users:id,name,email,role']));
    }

    public function update(Request $request, AccessGroup $accessGroup): JsonResponse
    {
        $this->authorizeGroups($request);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9\-]+$/', Rule::unique('access_groups', 'slug')->ignore($accessGroup->id)],
            'description' => 'nullable|string|max:500',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string',
        ]);

        if (array_key_exists('permissions', $validated)) {
            $validated['permissions'] = PermissionCatalog::sanitize($validated['permissions'] ?? []);
        }

        $accessGroup->fill($validated);
        $accessGroup->save();

        return response()->json($accessGroup->fresh());
    }

    public function destroy(Request $request, AccessGroup $accessGroup): JsonResponse
    {
        $this->authorizeGroups($request);

        $accessGroup->delete();

        return response()->json(null, 204);
    }

    private function authorizeGroups(Request $request): void
    {
        $u = $request->user();
        abort_unless(
            $u->isLabAdmin() || $u->hasCapability(PermissionCatalog::GROUPS_MANAGE),
            403,
            'Non autorisé'
        );
    }
}
