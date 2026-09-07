<?php

namespace App\Support;

final class MoneyFormat
{
    public static function currencyLabel(): string
    {
        return (string) config('app.currency_display', 'DH');
    }

    public static function formatHt(float|int|string|null $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ').' '.self::currencyLabel().' HT';
    }

    public static function format(float|int|string|null $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ').' '.self::currencyLabel();
    }
}
