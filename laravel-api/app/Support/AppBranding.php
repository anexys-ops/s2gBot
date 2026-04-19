<?php

namespace App\Support;

use App\Models\ModuleSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Logo société (module_settings app_branding) + helpers pour PDF (data URI).
 */
class AppBranding
{
    public const MODULE_KEY = 'app_branding';

    public static function settings(): array
    {
        $row = ModuleSetting::query()->where('module_key', self::MODULE_KEY)->first();

        return is_array($row?->settings) ? $row->settings : [];
    }

    /** Chemin relatif disque « public » (ex. branding/xxx.png), ou null. */
    public static function logoPublicPath(): ?string
    {
        $path = self::settings()['logo_public_path'] ?? null;

        return is_string($path) && $path !== '' ? $path : null;
    }

    /**
     * URL absolue du logo pour le navigateur (header app).
     */
    public static function logoHttpUrl(Request $request): ?string
    {
        $rel = self::logoPublicPath();
        if ($rel === null) {
            return null;
        }

        return $request->getSchemeAndHttpHost().Storage::disk('public')->url($rel);
    }

    /**
     * Data URI pour inclusion fiable dans DomPDF (évite fetch HTTP bloqué).
     */
    public static function logoDataUriForPdf(): ?string
    {
        $rel = self::logoPublicPath();
        if ($rel === null || ! Storage::disk('public')->exists($rel)) {
            return null;
        }
        $abs = Storage::disk('public')->path($rel);
        if (! is_readable($abs)) {
            return null;
        }
        $bin = @file_get_contents($abs);
        if ($bin === false) {
            return null;
        }
        $mime = mime_content_type($abs) ?: 'image/png';

        return 'data:'.$mime.';base64,'.base64_encode($bin);
    }

    public static function defaultLayoutConfig(): array
    {
        return [
            'export_pdf' => true,
            'export_docx' => false,
            'header' => [
                'show_logo' => true,
                'show_signature_block' => true,
                'photo_slots' => 0,
            ],
            'extra_fields' => [],
        ];
    }

    public static function mergeLayoutConfig(?array $stored): array
    {
        return array_replace_recursive(self::defaultLayoutConfig(), $stored ?? []);
    }
}
