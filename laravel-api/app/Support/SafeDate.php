<?php

namespace App\Support;

use Carbon\Carbon;
use DateTimeInterface;

/** Sérialisation de dates tolérante (évite les fatals sur données corrompues). */
final class SafeDate
{
    public static function toYmd(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    public static function compareYmd(mixed $a, mixed $b): int
    {
        return (self::toYmd($a) ?? '') <=> (self::toYmd($b) ?? '');
    }
}
