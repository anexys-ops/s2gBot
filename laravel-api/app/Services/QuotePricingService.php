<?php

namespace App\Services;

use App\Models\Quote;

/**
 * Lignes HT/TVA utilisées pour les totaux devis (forfait global ou forfait par jalon).
 */
class QuotePricingService
{
    public static function isDocumentForfait(array $meta): bool
    {
        return ($meta['mode_devis'] ?? '') === 'forfait';
    }

    /**
     * @param  array<string, mixed>  $jalon
     */
    public static function isJalonForfait(array $jalon): bool
    {
        return ($jalon['mode'] ?? '') === 'forfait';
    }

    /**
     * @return list<array{ht: float, tva_rate: float}>
     */
    public static function totalsLines(Quote $quote): array
    {
        $meta = is_array($quote->meta) ? $quote->meta : [];
        $documentTva = (float) $quote->tva_rate;

        if (self::isDocumentForfait($meta)) {
            $jalons = $meta['devis_jalons'] ?? [];
            if (is_array($jalons) && $jalons !== []) {
                $sum = 0.0;
                foreach ($jalons as $jalon) {
                    if (is_array($jalon)) {
                        $sum += self::forfaitJalonTotalHt($jalon);
                    }
                }
                if ($sum > 0) {
                    return [
                        ['ht' => round($sum, 2), 'tva_rate' => $documentTva],
                    ];
                }
            }

            $ht = round(max(0, (float) ($meta['tarif_global_hors_lignes_ht'] ?? 0)), 2);
            if ($ht > 0) {
                return [
                    ['ht' => $ht, 'tva_rate' => $documentTva],
                ];
            }
        }

        $jalons = $meta['devis_jalons'] ?? [];
        if (! is_array($jalons)) {
            $jalons = [];
        }

        $forfaitRefIds = [];
        $forfaitJalons = [];
        foreach ($jalons as $jalon) {
            if (! is_array($jalon) || ! self::isJalonForfait($jalon)) {
                continue;
            }
            $forfaitJalons[] = $jalon;
            foreach ($jalon['product_ref_article_ids'] ?? [] as $refId) {
                $id = (int) $refId;
                if ($id > 0) {
                    $forfaitRefIds[$id] = true;
                }
            }
        }

        $lines = [];
        foreach ($quote->quoteLines as $ql) {
            $refId = (int) ($ql->ref_article_id ?? 0);
            if ($refId > 0 && isset($forfaitRefIds[$refId])) {
                continue;
            }
            $lines[] = [
                'ht' => (float) $ql->total,
                'tva_rate' => (float) $ql->tva_rate,
            ];
        }

        foreach ($forfaitJalons as $jalon) {
            $ht = self::forfaitJalonTotalHt($jalon);
            $tva = isset($jalon['tva_rate']) ? (float) $jalon['tva_rate'] : $documentTva;
            $lines[] = [
                'ht' => $ht,
                'tva_rate' => $tva,
            ];
        }

        return $lines;
    }

    /**
     * @param  array<string, mixed>  $jalon
     */
    public static function forfaitJalonTotalHt(array $jalon): float
    {
        $qty = (float) ($jalon['quantity'] ?? 1);
        if ($qty <= 0) {
            $qty = 1;
        } else {
            $qty = max(1, round($qty));
        }

        if (array_key_exists('prix_unitaire_ht', $jalon)) {
            $pu = round(max(0, (float) $jalon['prix_unitaire_ht']), 2);

            return round($qty * $pu, 2);
        }

        return round(max(0, (float) ($jalon['montant_ht'] ?? 0)), 2);
    }
}
