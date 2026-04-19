<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModuleSetting;
use App\Support\AppBranding;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AppBrandingController extends Controller
{
    /** Logo URL pour l’interface (tout utilisateur connecté). */
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'logo_url' => AppBranding::logoHttpUrl($request),
        ]);
    }

    /** Upload / remplacement du logo (admin labo ou droit configuration). */
    public function uploadLogo(Request $request): JsonResponse
    {
        $u = $request->user();
        if (! $u->isLabAdmin() && ! $u->hasCapability(PermissionCatalog::CONFIG_MANAGE)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'logo' => 'required|file|mimes:jpeg,jpg,png,svg,webp|max:3072',
        ]);

        $file = $validated['logo'];
        $ext = strtolower($file->getClientOriginalExtension() ?: 'png');
        if ($ext === 'jpeg') {
            $ext = 'jpg';
        }
        $path = 'branding/app-logo.'.$ext;
        Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));

        $row = ModuleSetting::query()->firstOrNew(['module_key' => AppBranding::MODULE_KEY]);
        $settings = is_array($row->settings) ? $row->settings : [];
        $settings['logo_public_path'] = $path;
        $row->settings = $settings;
        $row->save();

        return response()->json([
            'logo_url' => AppBranding::logoHttpUrl($request),
            'logo_public_path' => $path,
        ]);
    }

    public function destroyLogo(Request $request): JsonResponse
    {
        $u = $request->user();
        if (! $u->isLabAdmin() && ! $u->hasCapability(PermissionCatalog::CONFIG_MANAGE)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $rel = AppBranding::logoPublicPath();
        if ($rel && Storage::disk('public')->exists($rel)) {
            Storage::disk('public')->delete($rel);
        }

        $row = ModuleSetting::query()->where('module_key', AppBranding::MODULE_KEY)->first();
        if ($row) {
            $settings = is_array($row->settings) ? $row->settings : [];
            $settings['logo_public_path'] = null;
            $row->settings = $settings;
            $row->save();
        }

        return response()->json(['logo_url' => null]);
    }
}
