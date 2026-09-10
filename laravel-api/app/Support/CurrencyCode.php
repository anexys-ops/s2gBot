<?php

namespace App\Support;

use App\Models\ModuleSetting;

final class CurrencyCode
{
    /** Devise société (catalogue, reporting interne). */
    public const BASE = 'MAD';

    /** @var array<string, string> ISO 4217 => libellé affichage */
    public const CORE_LABELS = [
        'MAD' => 'DH',
        'EUR' => '€',
        'USD' => 'USD',
        'GBP' => 'GBP',
        'CHF' => 'CHF',
        'CAD' => 'CAD',
        'SAR' => 'SAR',
        'AED' => 'AED',
        'XOF' => 'FCFA',
        'XAF' => 'FCFA',
    ];

    /** @var array<string, string> */
    public const CORE_NAMES = [
        'MAD' => 'Dirham marocain',
        'EUR' => 'Euro',
        'USD' => 'Dollar US',
        'GBP' => 'Livre sterling',
        'CHF' => 'Franc suisse',
        'CAD' => 'Dollar canadien',
        'SAR' => 'Riyal saoudien',
        'AED' => 'Dirham des EAU',
        'XOF' => 'Franc CFA (BCEAO)',
        'XAF' => 'Franc CFA (BEAC)',
    ];

    public static function normalize(?string $code): string
    {
        $normalized = strtoupper(trim((string) $code));

        if ($normalized === '') {
            return self::BASE;
        }

        return self::isSupported($normalized) ? $normalized : self::BASE;
    }

    public static function isSupported(string $code): bool
    {
        return array_key_exists(strtoupper($code), self::labels());
    }

    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        $labels = self::CORE_LABELS;

        foreach (self::extraCurrencyRows() as $row) {
            $code = strtoupper(trim((string) ($row['code'] ?? '')));
            if ($code === '' || strlen($code) !== 3) {
                continue;
            }
            $labels[$code] = trim((string) ($row['label'] ?? $code)) ?: $code;
        }

        return $labels;
    }

    /**
     * @return array<string, string>
     */
    public static function names(): array
    {
        $names = self::CORE_NAMES;

        foreach (self::extraCurrencyRows() as $row) {
            $code = strtoupper(trim((string) ($row['code'] ?? '')));
            if ($code === '' || strlen($code) !== 3) {
                continue;
            }
            $names[$code] = trim((string) ($row['name'] ?? $code)) ?: $code;
        }

        return $names;
    }

    /**
     * @return list<array{code: string, label: string, name: string}>
     */
    public static function catalog(): array
    {
        return collect(self::labels())
            ->map(fn (string $label, string $code) => [
                'code' => $code,
                'label' => $label,
                'name' => self::names()[$code] ?? $code,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    public static function foreignCodes(): array
    {
        return collect(self::labels())
            ->keys()
            ->filter(fn (string $code) => $code !== self::BASE)
            ->values()
            ->all();
    }

    public static function displayLabel(?string $code): string
    {
        $normalized = strtoupper(trim((string) $code));

        return self::labels()[$normalized] ?? ($normalized !== '' ? $normalized : self::BASE);
    }

    public static function displayName(?string $code): string
    {
        $normalized = strtoupper(trim((string) $code));

        return self::names()[$normalized] ?? self::displayLabel($code);
    }

    /**
     * @return list<array{code?: string, label?: string, name?: string}>
     */
    private static function extraCurrencyRows(): array
    {
        $stored = ModuleSetting::query()->where('module_key', 'fx_rates')->value('settings');
        $settings = is_array($stored) ? $stored : [];
        $extras = $settings['extra_currencies'] ?? [];

        return is_array($extras) ? $extras : [];
    }
}
