<?php

namespace App\Services;

use App\Models\Quote;
use App\Models\QuoteLine;

class QuotePdfPresentationService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function buildItemRows(Quote $quote): array
    {
        $meta = is_array($quote->meta) ? $quote->meta : [];
        $jalons = $meta['devis_jalons'] ?? [];
        $maskPrices = $meta['ligne_masque_prix_pdf'] ?? [];

        $linesByArticleId = [];
        foreach ($quote->quoteLines as $index => $line) {
            if ($line->ref_article_id) {
                $linesByArticleId[(int) $line->ref_article_id] = ['line' => $line, 'index' => $index];
            }
        }

        $rows = [];
        $seenLineIds = [];
        $itemNum = 0;

        foreach ($jalons as $jalon) {
            $label = trim((string) ($jalon['libelle'] ?? ''));
            if ($label !== '') {
                $rows[] = [
                    'type' => 'jalon_header',
                    'label' => $label,
                    'code' => $jalon['s2g_code'] ?? null,
                ];
            }

            $refIds = $jalon['product_ref_article_ids'] ?? [];
            foreach ($refIds as $refId) {
                $entry = $linesByArticleId[(int) $refId] ?? null;
                if (! $entry) {
                    continue;
                }
                /** @var QuoteLine $line */
                $line = $entry['line'];
                if (isset($seenLineIds[$line->id])) {
                    continue;
                }
                $mask = ($maskPrices[$entry['index']] ?? false) === true;
                $rows[] = $this->formatProductRow($line, ++$itemNum, $mask);
                $seenLineIds[$line->id] = true;
            }
        }

        foreach ($quote->quoteLines as $index => $line) {
            if (isset($seenLineIds[$line->id])) {
                continue;
            }
            $mask = ($maskPrices[$index] ?? false) === true;
            $rows[] = $this->formatProductRow($line, ++$itemNum, $mask);
        }

        return $rows;
    }

    /**
     * @return array<string, mixed>
     */
    public function buildContext(Quote $quote): array
    {
        $meta = is_array($quote->meta) ? $quote->meta : [];
        $tvaAmount = max(0, (float) $quote->amount_ttc - (float) $quote->amount_ht);

        $affaireParts = array_filter([
            $quote->site?->name,
            $quote->dossier?->titre ?? null,
        ]);
        $affaire = implode(' — ', $affaireParts);
        if ($affaire === '' && ! empty($quote->notes)) {
            $affaire = trim((string) $quote->notes);
        }

        $validite = null;
        if ($quote->valid_until) {
            $validite = 'Jusqu\'au '.$quote->valid_until->format('d/m/Y');
        } elseif (! empty($meta['conditions_commerciales'])) {
            $validite = trim((string) $meta['conditions_commerciales']);
        } else {
            $validite = '2 mois à compter de la date d\'envoi de la présente offre';
        }

        $reglement = trim((string) ($meta['delai_paiement'] ?? ''));
        if ($reglement === '' && ! empty($meta['mode_paiement'])) {
            $reglement = trim((string) $meta['mode_paiement']);
        }
        if ($reglement === '') {
            $reglement = '100% PAR CHEQUE A TRENTE JOURS DE FACTURE';
        }

        return [
            'affaire' => $affaire,
            'validite_label' => $validite,
            'reglement' => $reglement,
            'total_ht' => (float) $quote->amount_ht,
            'total_tva' => $tvaAmount,
            'total_ttc' => (float) $quote->amount_ttc,
            'is_forfait' => ($meta['mode_devis'] ?? '') === 'forfait',
            'forfait_ht' => (float) ($meta['tarif_global_hors_lignes_ht'] ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatProductRow(QuoteLine $line, int $num, bool $maskPrice): array
    {
        $article = $line->refArticle;
        $details = $this->detailLinesFor($line, $article?->description_commerciale ?? $article?->description ?? null);

        return [
            'type' => 'product',
            'num' => (string) $num,
            'label' => trim((string) $line->description),
            'unite' => $article?->unite ?? 'U',
            'qte' => (int) $line->quantity,
            'pu' => $maskPrice ? null : (float) $line->unit_price,
            'pt' => $maskPrice ? null : (float) $line->total,
            'details' => $details,
        ];
    }

    /**
     * @return list<string>
     */
    private function detailLinesFor(QuoteLine $line, ?string $extraDescription): array
    {
        $chunks = [];
        $main = trim((string) $line->description);
        if ($extraDescription) {
            foreach (preg_split('/\r?\n/', (string) $extraDescription) ?: [] as $part) {
                $part = trim($part);
                if ($part !== '' && $part !== $main) {
                    $chunks[] = $part;
                }
            }
        }

        return array_values(array_unique($chunks));
    }
}
