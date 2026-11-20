<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Lecture du champ « Nombre d'échantillons » d'un formulaire d'essai (clé libre saisie dans le
 * catalogue : nombre_d_echantillons, nb_echantillons…), miroir de react-frontend/src/lib/taskSampleCount.ts.
 */
final class FormSampleCount
{
    public static function isSampleCountKey(string $key): bool
    {
        $normalized = trim((string) preg_replace('/[^a-z0-9]+/', '_', Str::lower(Str::ascii($key))), '_');

        return (bool) preg_match('/^(nombre|nb|nbre)_(d_)?(de_)?echantillons?$/', $normalized);
    }

    /** @param  array<string, mixed>|null  $answers */
    public static function fromAnswers(?array $answers): ?int
    {
        foreach ($answers ?? [] as $key => $value) {
            if (! is_string($key) || ! self::isSampleCountKey($key)) {
                continue;
            }
            $number = (float) str_replace(',', '.', (string) $value);
            if ($number >= 1) {
                return (int) floor($number);
            }
        }

        return null;
    }
}
