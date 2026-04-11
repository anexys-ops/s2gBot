<?php

namespace App\Services;

/**
 * Calcul HT / TVA / TTC pour devis et factures (TVA par ligne, remises document, frais de port).
 */
class CommercialDocumentTotalsService
{
    public static function lineHt(float $quantity, float $unitPrice, float $lineDiscountPercent): float
    {
        $base = round($quantity * $unitPrice, 2);
        $p = max(0, min(100, $lineDiscountPercent));

        return round($base * (1 - $p / 100), 2);
    }

    /**
     * @param  array<int, array{ht: float, tva_rate: float}>  $lines
     * @return array{amount_ht: float, amount_ttc: float, lines_ht_subtotal: float, lines_ht_after_discount: float, amount_tva: float}
     */
    public static function computeTotals(
        array $lines,
        float $documentDiscountPercent,
        float $documentDiscountAmount,
        float $shippingAmountHt,
        float $shippingTvaRate,
        float $travelFeeHt = 0,
        float $travelFeeTvaRate = 20,
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
        $totalTva = round($scaledTva + $shipTva + $travelTva, 2);
        $totalTtc = round($totalHt + $totalTva, 2);

        return [
            'lines_ht_subtotal' => round($linesHt, 2),
            'lines_ht_after_discount' => $afterDiscount,
            'amount_ht' => $totalHt,
            'amount_tva' => $totalTva,
            'amount_ttc' => $totalTtc,
        ];
    }
}
