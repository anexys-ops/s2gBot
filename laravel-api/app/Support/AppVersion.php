<?php

namespace App\Support;

/**
 * Version affichée par /api/version : alignée sur le frontend (package.json du monorepo).
 * Surcharge possible via APP_VERSION dans .env si besoin ponctuel.
 */
class AppVersion
{
    public static function detect(): string
    {
        $root = dirname(__DIR__, 3);
        $pkgPath = $root.'/react-frontend/package.json';
        if (is_readable($pkgPath)) {
            $raw = file_get_contents($pkgPath);
            if ($raw !== false) {
                $j = json_decode($raw, true);
                if (is_array($j) && isset($j['version']) && is_string($j['version']) && $j['version'] !== '') {
                    return $j['version'];
                }
            }
        }

        return '1.0.3';
    }

    public static function resolve(): string
    {
        $fromEnv = env('APP_VERSION');
        if (is_string($fromEnv) && trim($fromEnv) !== '') {
            return trim($fromEnv);
        }

        return self::detect();
    }
}
