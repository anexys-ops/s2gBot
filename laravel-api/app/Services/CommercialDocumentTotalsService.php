<?php

namespace App\Services;

/**
 * Calcul HT / TVA / TTC pour devis et factures (TVA par ligne, remises document, frais de port).
 */
class CommercialDocumentTotalsService
{
    public const CA_ANNUEL_TVA_RECUPERABLE_RATIO = 0.25;

    public const CA_ANNUEL_TVA_ETAT_RATIO = 0.75;

    public static function lineHt(float $quantity, float $unitPrice, float $lineDiscountPercent): float
    {
        $base = round($quantity * $unitPrice, 2);
        $p = max(0, min(100, $lineDiscountPercent));

        return round($base * (1 - $p / 100), 2);
    }

    /**
     * @return array{tva_nominale: float, tva_recuperable: float, tva_etat: float, amount_tva: float}
     */
    public static function applyCaAnnuelTvaRegime(float $nominalTva): array
    {
        $tvaNominale = round(max(0, $nominalTva), 2);
        $tvaRecuperable = round($tvaNominale * self::CA_ANNUEL_TVA_RECUPERABLE_RATIO, 2);
        $tvaEtat = round($tvaNominale * self::CA_ANNUEL_TVA_ETAT_RATIO, 2);

        return [
            'tva_nominale' => $tvaNominale,
            'tva_recuperable' => $tvaRecuperable,
            'tva_etat' => $tvaEtat,
            'amount_tva' => $tvaEtat,
        ];
    }

    public static function ttcFromHt(float $ht, float $nominalTvaRate, bool $caAnnuelTvaRegime = false): float
    {
        $safeHt = max(0, round($ht, 2));
        $rate = max(0, min(100, $nominalTvaRate));
        $nominalTva = round($safeHt * ($rate / 100), 2);
        if (! $caAnnuelTvaRegime) {
            return round($safeHt + $nominalTva, 2);
        }

        return round($safeHt + self::applyCaAnnuelTvaRegime($nominalTva)['amount_tva'], 2);
    }

    /**
     * @param  array<int, array{ht: float, tva_rate: float}>  $lines
     * @return array{
     *     amount_ht: float,
     *     amount_ttc: float,
     *     lines_ht_subtotal: float,
     *     lines_ht_after_discount: float,
     *     amount_tva: float,
     *     tva_nominale: float,
     *     tva_recuperable: float,
     *     tva_etat: float,
     *     ca_annuel_tva_regime: bool
     * }
     */
    public static function computeTotals(
        array $lines,
        float $documentDiscountPercent,
        float $documentDiscountAmount,
        float $shippingAmountHt,
        float $shippingTvaRate,
        float $travelFeeHt = 0,
        float $travelFeeTvaRate = 20,
        bool $caAnnuelTvaRegime = false,
    ): array {
        $linesHt = 0.0;
        $linesTva = 0.0;
        foreach ($lines as $line) {
            $ht = $line['ht'];
            $rate = max(0, min(100, $line['tva_rate']));
            $linesHt += $ht;
            $linesTva += round($ht * ($rate / 100), 2);
        }

        $dp = max(0, min(100, $documentDiscountPercent));
        $afterPct = round($linesHt * (1 - $dp / 100), 2);
        $afterDiscount = max(0, round($afterPct - $documentDiscountAmount, 2));

        $ratio = $linesHt > 0 ? ($afterDiscount / $linesHt) : 0;
        $scaledTva = round($linesTva * $ratio, 2);

        $shipRate = max(0, min(100, $shippingTvaRate));
        $shipTva = round($shippingAmountHt * ($shipRate / 100), 2);

        $travelHt = max(0, round($travelFeeHt, 2));
        $trRate = max(0, min(100, $travelFeeTvaRate));
        $travelTva = round($travelHt * ($trRate / 100), 2);

        $totalHt = round($afterDiscount + $shippingAmountHt + $travelHt, 2);
        $totalTvaNominal = round($scaledTva + $shipTva + $travelTva, 2);

        if ($caAnnuelTvaRegime) {
            $split = self::applyCaAnnuelTvaRegime($totalTvaNominal);
            $totalTva = $split['amount_tva'];
            $tvaNominale = $split['tva_nominale'];
            $tvaRecuperable = $split['tva_recuperable'];
            $tvaEtat = $split['tva_etat'];
        } else {
            $totalTva = $totalTvaNominal;
            $tvaNominale = $totalTvaNominal;
            $tvaRecuperable = 0.0;
            $tvaEtat = $totalTvaNominal;
        }

        $totalTtc = round($totalHt + $totalTva, 2);

        return [
            'lines_ht_subtotal' => round($linesHt, 2),
            'lines_ht_after_discount' => $afterDiscount,
            'amount_ht' => $totalHt,
            'amount_tva' => $totalTva,
            'amount_ttc' => $totalTtc,
            'tva_nominale' => $tvaNominale,
            'tva_recuperable' => $tvaRecuperable,
            'tva_etat' => $tvaEtat,
            'ca_annuel_tva_regime' => $caAnnuelTvaRegime,
        ];
    }
}
