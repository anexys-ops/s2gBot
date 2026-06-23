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

    /** @var list<string> */
    private const DEFAULT_LOGO_PUBLIC_FILES = [
        'branding/s2g-app-logo.png',
        'branding/s2g-devis-letterhead.png',
    ];

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

    public static function hasCustomLogo(): bool
    {
        $rel = self::logoPublicPath();

        return $rel !== null && Storage::disk('public')->exists($rel);
    }

    /**
     * URL absolue du logo pour le navigateur (header app).
     */
    public static function logoHttpUrl(Request $request): ?string
    {
        $rel = self::logoPublicPath();
        if ($rel !== null && Storage::disk('public')->exists($rel)) {
            return $request->getSchemeAndHttpHost().Storage::disk('public')->url($rel);
        }

        $default = self::defaultLogoPublicPath();
        if ($default !== null) {
            return $request->getSchemeAndHttpHost().'/'.ltrim($default, '/');
        }

        return null;
    }

    /**
     * Data URI pour inclusion fiable dans DomPDF (évite fetch HTTP bloqué).
     */
    public static function logoDataUriForPdf(): ?string
    {
        $uri = self::fileToDataUri(self::logoPublicPath());
        if ($uri !== null) {
            return $uri;
        }

        foreach (self::DEFAULT_LOGO_PUBLIC_FILES as $rel) {
            $uri = self::absolutePathToDataUri(public_path($rel));
            if ($uri !== null) {
                return $uri;
            }
        }

        return null;
    }

    /** Chemin relatif sous public/ pour le logo S2G embarqué, ou null. */
    public static function defaultLogoPublicPath(): ?string
    {
        foreach (self::DEFAULT_LOGO_PUBLIC_FILES as $rel) {
            if (is_readable(public_path($rel))) {
                return $rel;
            }
        }

        return null;
    }

    /** En-tête pleine largeur pour PDF devis S2G (priorité sur le logo compact). */
    public static function devisLetterheadDataUriForPdf(): ?string
    {
        $settings = self::settings();
        $rel = $settings['devis_letterhead_public_path'] ?? null;
        if (is_string($rel) && $rel !== '') {
            $uri = self::fileToDataUri($rel);
            if ($uri !== null) {
                return $uri;
            }
        }

        foreach ([
            public_path('branding/s2g-devis-letterhead.png'),
            public_path('branding/s2g-devis-letterhead.jpg'),
        ] as $abs) {
            $uri = self::absolutePathToDataUri($abs);
            if ($uri !== null) {
                return $uri;
            }
        }

        foreach (['branding/s2g-devis-letterhead.png', 'branding/s2g-devis-letterhead.jpg', 'branding/devis-letterhead.jpg'] as $fallback) {
            $uri = self::fileToDataUri($fallback);
            if ($uri !== null) {
                return $uri;
            }
        }

        return self::logoDataUriForPdf();
    }

    private static function absolutePathToDataUri(string $abs): ?string
    {
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

    private static function fileToDataUri(?string $rel): ?string
    {
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
