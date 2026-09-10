<?php

namespace App\Support;

final class CurrencyCode
{
    /** Devise société (catalogue, reporting interne). */
    public const BASE = 'MAD';

    /** @var array<string, string> ISO 4217 => libellé affichage */
    public const LABELS = [
        'MAD' => 'DH',
        'EUR' => '€',
        'USD' => 'USD',
        'GBP' => 'GBP',
        'CHF' => 'CHF',
        'CAD' => 'CAD',
        'SAR' => 'SAR',
        'AED' => 'AED',
    ];

    public static function normalize(?string $code): string
    {
        $normalized = strtoupper(trim((string) $code));

        return self::isSupported($normalized) ? $normalized : self::BASE;
    }

    public static function isSupported(string $code): bool
    {
        return array_key_exists(strtoupper($code), self::LABELS);
    }

    /**
     * @return list<array{code: string, label: string, name: string}>
     */
    public static function catalog(): array
    {
        $names = [
            'MAD' => 'Dirham marocain',
            'EUR' => 'Euro',
            'USD' => 'Dollar US',
            'GBP' => 'Livre sterling',
            'CHF' => 'Franc suisse',
            'CAD' => 'Dollar canadien',
            'SAR' => 'Riyal saoudien',
            'AED' => 'Dirham des EAU',
        ];

        return collect(self::LABELS)
            ->map(fn (string $label, string $code) => [
                'code' => $code,
                'label' => $label,
                'name' => $names[$code] ?? $code,
            ])
            ->values()
            ->all();
    }

    public static function displayLabel(?string $code): string
    {
        $normalized = self::normalize($code);

        return self::LABELS[$normalized] ?? $normalized;
    }
}
