<?php

namespace App\Support;

final class MoneyFormat
{
    public static function currencyLabel(?string $currencyCode = null): string
    {
        if ($currencyCode !== null && $currencyCode !== '') {
            return CurrencyCode::displayLabel($currencyCode);
        }

        return (string) config('app.currency_display', 'DH');
    }

    public static function formatHt(float|int|string|null $amount, ?string $currencyCode = null): string
    {
        return number_format((float) $amount, 2, ',', ' ').' '.self::currencyLabel($currencyCode).' HT';
    }

    public static function format(float|int|string|null $amount, ?string $currencyCode = null): string
    {
        return number_format((float) $amount, 2, ',', ' ').' '.self::currencyLabel($currencyCode);
    }
}
