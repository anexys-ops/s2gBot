<?php

namespace App\Services;

use Illuminate\Support\Facades\File;

/**
 * Cache disque des PDF commerciaux (devis, BC, BL…) pour éviter une régénération DomPDF à chaque aperçu.
 */
final class CommercialPdfCache
{
    /**
     * @param  callable(): array{0: string, 1: string}  $generate
     * @return array{0: string, 1: string}
     */
    public function remember(string $cacheKey, callable $generate): array
    {
        $path = $this->pathForKey($cacheKey);
        if (File::isFile($path)) {
            $metaPath = $path.'.meta';
            $filename = File::isFile($metaPath) ? trim((string) File::get($metaPath)) : 'document.pdf';

            return [(string) File::get($path), $filename !== '' ? $filename : 'document.pdf'];
        }

        [$bytes, $filename] = $generate();
        File::ensureDirectoryExists(dirname($path));
        File::put($path, $bytes);
        File::put($path.'.meta', $filename);

        return [$bytes, $filename];
    }

    public function keyForDocument(string $type, int $id, ?int $templateId, int $sourceUpdatedAt, int $templateUpdatedAt = 0): string
    {
        return implode('|', [
            $type,
            (string) $id,
            (string) ($templateId ?? 0),
            (string) $sourceUpdatedAt,
            (string) $templateUpdatedAt,
        ]);
    }

    private function pathForKey(string $cacheKey): string
    {
        return storage_path('app/pdf-cache/'.hash('sha256', $cacheKey).'.pdf');
    }
}
