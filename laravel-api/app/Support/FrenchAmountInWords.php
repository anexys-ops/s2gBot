<?php

namespace App\Support;

/**
 * Montant entier en toutes lettres (français) — usage PDF devis.
 */
class FrenchAmountInWords
{
    private const UNITS = [
        0 => 'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
        'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
    ];

    public static function format(float $amount, string $currencyLabel = 'DIRHAMS'): string
    {
        $int = (int) round($amount);

        return ucfirst(trim(self::intToWords($int))).' '.strtoupper($currencyLabel);
    }

    private static function intToWords(int $n): string
    {
        if ($n < 0) {
            return 'moins '.self::intToWords(-$n);
        }
        if ($n < 20) {
            return self::UNITS[$n];
        }
        if ($n < 100) {
            $tens = (int) floor($n / 10);
            $unit = $n % 10;
            if ($n < 70) {
                return $unit === 0
                    ? ($tens === 7 ? 'soixante-dix' : self::UNITS[$tens].'-dix')
                    : ($tens === 7 ? 'soixante-'.self::UNITS[10 + $unit] : self::UNITS[$tens].'-'.self::UNITS[$unit]);
            }
            if ($n < 80) {
                return $unit === 0 ? 'quatre-vingts' : 'quatre-vingt-'.self::UNITS[$unit];
            }

            return $unit === 0 ? 'quatre-vingt-dix' : 'quatre-vingt-'.self::UNITS[10 + $unit];
        }
        if ($n < 200) {
            return $n === 100 ? 'cent' : 'cent '.self::intToWords($n - 100);
        }
        if ($n < 1000) {
            $hundreds = (int) floor($n / 100);
            $rest = $n % 100;

            return ($hundreds === 1 ? 'cent' : self::UNITS[$hundreds].' cent'.($rest === 0 ? 's' : ''))
                .($rest > 0 ? ' '.self::intToWords($rest) : '');
        }
        if ($n < 2000) {
            return 'mille'.($n === 1000 ? '' : ' '.self::intToWords($n - 1000));
        }
        if ($n < 1000000) {
            $thousands = (int) floor($n / 1000);
            $rest = $n % 1000;

            return self::intToWords($thousands).' mille'.($rest > 0 ? ' '.self::intToWords($rest) : '');
        }

        $millions = (int) floor($n / 1000000);
        $rest = $n % 1000000;

        return self::intToWords($millions).' million'.($millions > 1 ? 's' : '')
            .($rest > 0 ? ' '.self::intToWords($rest) : '');
    }
}
