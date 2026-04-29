<?php

namespace App\Support;

/**
 * Version affichée par /api/version : alignée sur le frontend (package.json du monorepo).
 * Surcharge possible via APP_VERSION (souvent injectée en prod par Docker / .env.docker).
 *
 * Ne pas s'appuyer sur {@see env()} seul : avec `config:cache`, le helper `env()` renvoie
 * null hors des fichiers de config, alors que la variable d'environnement du conteneur
 * reste disponible via {@see getenv()}.
 */
class AppVersion
{
    /**
     * @return non-empty-string|null
     */
    public static function versionFromEnvironment(): ?string
    {
        $fromGetenv = getenv('APP_VERSION');
        $candidates = [
            env('APP_VERSION'),
            ($fromGetenv !== false && is_string($fromGetenv)) ? $fromGetenv : null,
            isset($_ENV['APP_VERSION']) && is_string($_ENV['APP_VERSION']) ? $_ENV['APP_VERSION'] : null,
            isset($_SERVER['APP_VERSION']) && is_string($_SERVER['APP_VERSION']) ? $_SERVER['APP_VERSION'] : null,
        ];
        foreach ($candidates as $v) {
            if (is_string($v) && trim($v) !== '') {
                return trim($v);
            }
        }

        return null;
    }

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

        return '1.2.0';
    }

    public static function resolve(): string
    {
        $fromEnv = self::versionFromEnvironment();
        if ($fromEnv !== null) {
            return $fromEnv;
        }

        return self::detect();
    }
}
