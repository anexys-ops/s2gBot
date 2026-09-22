<?php

namespace App\Services;

use App\Models\BonCommande;

final class BonCommandeTotalsService
{
    /**
     * Recalcule et persiste les totaux dérivés des lignes lorsque l'en-tête du BC est obsolète.
     *
     * @return array{amount_ht: float, amount_ttc: float}
     */
    public function synchronize(BonCommande $bonCommande): array
    {
        $bonCommande->loadMissing(['lignes', 'client', 'quote']);
        $meta = is_array($bonCommande->quote?->meta) ? $bonCommande->quote->meta : [];
        $globalForfait = QuotePricingService::isDocumentForfait($meta)
            && (float) ($meta['tarif_global_hors_lignes_ht'] ?? 0) > 0;
        $forfaitChildRefIds = [];
        foreach (($meta['devis_jalons'] ?? []) as $jalon) {
            if (! is_array($jalon) || ! QuotePricingService::isJalonForfait($jalon)) {
                continue;
            }
            foreach (($jalon['product_ref_article_ids'] ?? []) as $refId) {
                if ((int) $refId > 0) {
                    $forfaitChildRefIds[(int) $refId] = true;
                }
            }
        }
        $rows = [];
        foreach ($bonCommande->lignes as $ligne) {
            $refId = (int) ($ligne->ref_article_id ?? 0);
            if (($globalForfait && $refId > 0) || ($refId > 0 && isset($forfaitChildRefIds[$refId]))) {
                continue;
            }
            $rows[] = [
                'ht' => (float) $ligne->montant_ht,
                'tva_rate' => (float) $ligne->tva_rate,
            ];
        }

        $totals = CommercialDocumentTotalsService::computeTotals(
            $rows,
            0,
            0,
            0,
            0,
            0,
            20,
            $bonCommande->client?->usesCaAnnuelTvaRegime() ?? false,
        );

        $amountHt = (float) $totals['amount_ht'];
        $amountTtc = (float) $totals['amount_ttc'];
        if (abs((float) $bonCommande->montant_ht - $amountHt) >= 0.005
            || abs((float) $bonCommande->montant_ttc - $amountTtc) >= 0.005
        ) {
            $bonCommande->update([
                'montant_ht' => $amountHt,
                'montant_ttc' => $amountTtc,
            ]);
        }

        return [
            'amount_ht' => $amountHt,
            'amount_ttc' => $amountTtc,
        ];
    }
}
