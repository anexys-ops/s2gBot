<?php

namespace App\Support;

/**
 * Nom affiché aux utilisateurs (emails, PDF, UI) — sans le suffixe « API » du nom Laravel interne.
 */
class AppDisplayName
{
    public static function resolve(): string
    {
        $fromName = config('mail.from.name');
        if (is_string($fromName) && trim($fromName) !== '') {
            return trim($fromName);
        }

        $appName = (string) config('app.name', 'Lab BTP');
        $stripped = preg_replace('/\s+API$/i', '', $appName);

        return ($stripped !== null && trim($stripped) !== '') ? trim($stripped) : 'Lab BTP';
    }
}
