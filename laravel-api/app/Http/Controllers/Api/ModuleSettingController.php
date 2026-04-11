<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModuleSetting;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModuleSettingController extends Controller
{
    public function show(Request $request, string $moduleKey): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $row = ModuleSetting::query()->where('module_key', $moduleKey)->first();
        if (! $row) {
            return response()->json(['message' => 'Module inconnu'], 404);
        }

        return response()->json([
            'module_key' => $row->module_key,
            'settings' => $row->settings ?? [],
        ]);
    }

    public function update(Request $request, string $moduleKey): JsonResponse
    {
        $u = $request->user();
        if (! $u->isLabAdmin() && ! $u->hasCapability(PermissionCatalog::CONFIG_MANAGE)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'settings' => 'required|array',
        ]);

        $row = ModuleSetting::query()->firstOrNew(['module_key' => $moduleKey]);
        if (! $row->exists) {
            return response()->json(['message' => 'Module inconnu'], 404);
        }

        $row->settings = array_replace_recursive($row->settings ?? [], $validated['settings']);
        $row->save();

        return response()->json([
            'module_key' => $row->module_key,
            'settings' => $row->settings,
        ]);
    }
}
