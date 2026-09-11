<?php

namespace App\Services;

use App\Models\Quote;
use App\Models\QuoteLine;
use Illuminate\Support\Collection;

class QuotePdfPresentationService
{
    /** @var list<string> */
    private const DETAIL_SKIP = [
        'description commerciale',
        'description technique',
        '..',
        '…',
        '-',
        '—',
        'n/a',
        'na',
        'null',
    ];

    /**
     * @param  array<string, mixed>|null  $layoutConfig
     * @return list<array<string, mixed>>
     */
    public function buildItemRows(Quote $quote, ?array $layoutConfig = null): array
    {
        $linesCfg = is_array($layoutConfig['lines'] ?? null) ? $layoutConfig['lines'] : [];
        $hideAllPrices = ($linesCfg['show_prices'] ?? true) === false;

        $meta = is_array($quote->meta) ? $quote->meta : [];
        $jalons = $meta['devis_jalons'] ?? [];
        $parcours = $meta['devis_parcours'] ?? [];
        $maskPrices = $meta['ligne_masque_prix_pdf'] ?? [];
        $documentForfait = ($meta['mode_devis'] ?? '') === 'forfait';

        /** @var Collection<int, QuoteLine> $lines */
        $lines = $quote->quoteLines->values();

        $jalonById = [];
        $childRefIds = [];
        foreach ($jalons as $jalon) {
            $id = $jalon['id'] ?? null;
            if (is_string($id) && $id !== '') {
                $jalonById[$id] = $jalon;
            }
            foreach ($jalon['product_ref_article_ids'] ?? [] as $refId) {
                $childRefIds[(int) $refId] = true;
            }
        }

        $rows = [];
        $seenLineIds = [];
        $itemNum = 0;

        if ($parcours !== []) {
            foreach ($parcours as $item) {
                $kind = $item['kind'] ?? null;
                if ($kind === 'jalon') {
                    $jalon = $jalonById[$item['id'] ?? ''] ?? null;
                    if ($jalon === null) {
                        continue;
                    }
                    $jalonForfait = $documentForfait || (($jalon['mode'] ?? '') === 'forfait');
                    $rows[] = $this->formatJalonHeaderRow($jalon, $jalonForfait && ! $documentForfait);
                    if ($jalonForfait && ! $documentForfait) {
                        $rows[] = $this->formatJalonForfaitRow($jalon);
                    }
                    foreach ($jalon['product_ref_article_ids'] ?? [] as $refId) {
                        $entry = $this->findLineByRefId($lines, (int) $refId, $seenLineIds);
                        if ($entry === null) {
                            continue;
                        }
                        $hidePrices = $hideAllPrices || $documentForfait || $jalonForfait;
                        $mask = $hidePrices || ($maskPrices[$entry['index']] ?? false) === true;
                        $rows[] = $this->formatProductRow($entry['line'], ++$itemNum, $mask, true, $hidePrices);
                        $seenLineIds[$entry['line']->id] = true;
                    }

                    continue;
                }

                if ($kind === 'ligne') {
                    $entry = $this->nextStandaloneLine($lines, $seenLineIds, $childRefIds);
                    if ($entry === null) {
                        continue;
                    }
                    $mask = $hideAllPrices || $documentForfait || ($maskPrices[$entry['index']] ?? false) === true;
                    $rows[] = $this->formatProductRow($entry['line'], ++$itemNum, $mask, false, $documentForfait);
                    $seenLineIds[$entry['line']->id] = true;
                }
            }
        } elseif ($jalons !== []) {
            foreach ($jalons as $jalon) {
                $jalonForfait = $documentForfait || (($jalon['mode'] ?? '') === 'forfait');
                $rows[] = $this->formatJalonHeaderRow($jalon, $jalonForfait && ! $documentForfait);
                if ($jalonForfait && ! $documentForfait) {
                    $rows[] = $this->formatJalonForfaitRow($jalon);
                }
                foreach ($jalon['product_ref_article_ids'] ?? [] as $refId) {
                    $entry = $this->findLineByRefId($lines, (int) $refId, $seenLineIds);
                    if ($entry === null) {
                        continue;
                    }
                    $hidePrices = $documentForfait || $jalonForfait;
                    $mask = $hidePrices || ($maskPrices[$entry['index']] ?? false) === true;
                    $rows[] = $this->formatProductRow($entry['line'], ++$itemNum, $mask, true, $hidePrices);
                    $seenLineIds[$entry['line']->id] = true;
                }
            }
        }

        foreach ($lines as $index => $line) {
            if (isset($seenLineIds[$line->id])) {
                continue;
            }
            $mask = $hideAllPrices || $documentForfait || ($maskPrices[$index] ?? false) === true;
            $rows[] = $this->formatProductRow($line, ++$itemNum, $mask, false, $documentForfait);
            $seenLineIds[$line->id] = true;
        }

        if ($documentForfait) {
            $forfaitHt = $this->resolveForfaitHt($quote, $meta, $lines);
            if ($forfaitHt > 0) {
                array_unshift($rows, $this->formatDocumentForfaitRow($meta, $hideAllPrices, $forfaitHt));
            }
        }

        if ($hideAllPrices) {
            foreach ($rows as $i => $row) {
                if (($row['type'] ?? '') === 'forfait_total') {
                    $rows[$i]['pu'] = null;
                    $rows[$i]['pt'] = null;
                }
            }
        }

        return $rows;
    }

    /**
     * @return array<string, mixed>
     */
    public function buildContext(Quote $quote): array
    {
        $meta = is_array($quote->meta) ? $quote->meta : [];

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

        $quote->loadMissing('client');
        $caAnnuelTvaRegime = $quote->client?->usesCaAnnuelTvaRegime() ?? false;

        $fraisSupp = $this->sumFraisSupplementaires($meta, $caAnnuelTvaRegime);
        $totalHt = (float) $quote->amount_ht;
        $totalTva = round(max(0, (float) $quote->amount_ttc - (float) $quote->amount_ht), 2);
        $totalTtc = round((float) $quote->amount_ttc + $fraisSupp['total_ttc'], 2);

        $linesData = [];
        $linesTvaBefore = 0.0;
        foreach ($quote->quoteLines as $line) {
            $ht = (float) $line->total;
            $rate = max(0, min(100, (float) $line->tva_rate));
            $linesData[] = ['ht' => $ht, 'tva_rate' => $rate];
            $linesTvaBefore += round($ht * ($rate / 100), 2);
        }

        $computed = CommercialDocumentTotalsService::computeTotals(
            $linesData,
            (float) $quote->discount_percent,
            (float) $quote->discount_amount,
            (float) $quote->shipping_amount_ht,
            (float) $quote->shipping_tva_rate,
            (float) $quote->travel_fee_ht,
            (float) $quote->travel_fee_tva_rate,
            $caAnnuelTvaRegime,
        );

        $linesHtSubtotal = $computed['lines_ht_subtotal'];
        $linesAfterDiscount = $computed['lines_ht_after_discount'];
        $discountHt = round(max(0, $linesHtSubtotal - $linesAfterDiscount), 2);
        $scaledTva = $linesHtSubtotal > 0
            ? round($linesTvaBefore * ($linesAfterDiscount / $linesHtSubtotal), 2)
            : 0.0;
        $discountTva = round(max(0, $linesTvaBefore - $scaledTva), 2);
        $discountTtc = round($discountHt + $discountTva, 2);

        $discountPercent = (float) $quote->discount_percent;
        $discountAmount = (float) $quote->discount_amount;
        $hasDiscount = $discountHt > 0.001 || $discountPercent > 0.001 || $discountAmount > 0.001;

        $discountLabelParts = [];
        if ($discountPercent > 0) {
            $discountLabelParts[] = '-'.number_format($discountPercent, 2, ',', "\xc2\xa0").' %';
        }
        if ($discountAmount > 0) {
            $discountLabelParts[] = '-'.number_format($discountAmount, 2, ',', "\xc2\xa0").' DH HT';
        }
        $discountLabel = $discountLabelParts !== []
            ? 'Remise ('.implode(' + ', $discountLabelParts).')'
            : 'Remise';

        return [
            'affaire' => $affaire,
            'validite_label' => $validite,
            'reglement' => $reglement,
            'total_ht' => $totalHt,
            'total_tva' => $totalTva,
            'total_ttc' => $totalTtc,
            'subtotal_ht' => $linesHtSubtotal,
            'subtotal_tva' => $linesTvaBefore,
            'subtotal_ttc' => round($linesHtSubtotal + $linesTvaBefore, 2),
            'discount_percent' => $discountPercent,
            'discount_amount' => $discountAmount,
            'discount_ht' => $discountHt,
            'discount_tva' => $discountTva,
            'discount_ttc' => $discountTtc,
            'discount_label' => $discountLabel,
            'has_discount' => $hasDiscount,
            'frais_supplementaires_ttc' => $fraisSupp['total_ttc'],
            'frais_supplementaires' => $fraisSupp['items'],
            'is_forfait' => ($meta['mode_devis'] ?? '') === 'forfait',
            'forfait_ht' => $this->resolveForfaitHt($quote, $meta, $quote->quoteLines),
            'ca_annuel_tva_regime' => $caAnnuelTvaRegime,
            'tva_nominale' => $computed['tva_nominale'],
            'tva_recuperable' => $computed['tva_recuperable'],
            'tva_etat' => $computed['tva_etat'],
        ];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  Collection<int, QuoteLine>|iterable<int, QuoteLine>  $lines
     */
    private function resolveForfaitHt(Quote $quote, array $meta, iterable $lines): float
    {
        if (QuotePricingService::isDocumentForfait($meta)) {
            $fromMeta = (float) ($meta['tarif_global_hors_lignes_ht'] ?? 0);
            if ($fromMeta > 0) {
                return round($fromMeta, 2);
            }
        }

        $jalons = $meta['devis_jalons'] ?? [];
        if (is_array($jalons) && $jalons !== []) {
            $sum = 0.0;
            foreach ($jalons as $jalon) {
                if (is_array($jalon)) {
                    $sum += QuotePricingService::forfaitJalonTotalHt($jalon);
                }
            }
            if ($sum > 0) {
                return round($sum, 2);
            }
        }

        $fromMeta = (float) ($meta['tarif_global_hors_lignes_ht'] ?? 0);
        if ($fromMeta > 0) {
            return round($fromMeta, 2);
        }

        $sum = 0.0;
        foreach ($lines as $line) {
            $sum += (float) $line->total;
        }
        if ($sum > 0) {
            return round($sum, 2);
        }

        return round((float) $quote->amount_ht, 2);
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array{items: list<array<string, mixed>>, total_ht: float, total_tva: float, total_ttc: float}
     */
    private function sumFraisSupplementaires(array $meta, bool $caAnnuelTvaRegime = false): array
    {
        $rows = $meta['frais_supplementaires'] ?? [];
        if (! is_array($rows)) {
            return ['items' => [], 'total_ht' => 0.0, 'total_tva' => 0.0, 'total_ttc' => 0.0];
        }

        $items = [];
        $totalHt = 0.0;
        $totalTva = 0.0;
        $totalTtc = 0.0;

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $lineHt = max(0, (float) ($row['montant_ht'] ?? 0));
            $rate = max(0, min(100, (float) ($row['tva_rate'] ?? 0)));
            $lineTvaNominal = round($lineHt * ($rate / 100), 2);
            $lineTva = $caAnnuelTvaRegime
                ? CommercialDocumentTotalsService::applyCaAnnuelTvaRegime($lineTvaNominal)['amount_tva']
                : $lineTvaNominal;
            $lineTtc = round($lineHt + $lineTva, 2);
            $description = trim((string) ($row['description'] ?? ''));

            if ($lineTtc <= 0 && $description === '') {
                continue;
            }

            $totalHt += $lineHt;
            $totalTva += $lineTva;
            $totalTtc += $lineTtc;
            $items[] = [
                'description' => $description !== '' ? $description : 'Frais supplémentaire',
                'montant_ht' => $lineHt,
                'tva' => $lineTva,
                'montant_ttc' => $lineTtc,
            ];
        }

        return [
            'items' => $items,
            'total_ht' => round($totalHt, 2),
            'total_tva' => round($totalTva, 2),
            'total_ttc' => round($totalTtc, 2),
        ];
    }

    /**
     * @param  array<string, mixed>  $jalon
     * @return array<string, mixed>
     */
    private function formatJalonHeaderRow(array $jalon, bool $isForfait = false): array
    {
        return [
            'type' => 'jalon_header',
            'label' => trim((string) ($jalon['libelle'] ?? '')),
            'code' => $jalon['s2g_code'] ?? null,
            'is_forfait' => $isForfait,
        ];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function formatDocumentForfaitRow(array $meta, bool $hidePrices, float $forfaitHt): array
    {
        $qty = (float) ($meta['tarif_global_quantity'] ?? 1);
        if ($qty <= 0) {
            $qty = 1;
        } else {
            $qty = max(1, round($qty));
        }

        $unite = trim((string) ($meta['tarif_global_unite'] ?? ''));
        if ($unite === '') {
            $unite = 'F';
        }

        $label = trim((string) ($meta['tarif_global_designation'] ?? ''));
        if ($label === '') {
            $label = 'Prestation forfaitaire';
        }

        if (array_key_exists('tarif_global_prix_unitaire_ht', $meta)) {
            $pu = round(max(0, (float) $meta['tarif_global_prix_unitaire_ht']), 2);
            $pt = round($forfaitHt, 2);
        } else {
            $pt = round($forfaitHt, 2);
            $pu = $qty > 0 ? round($pt / $qty, 2) : $pt;
        }

        return [
            'type' => 'forfait_total',
            'label' => $label,
            'unite' => $unite,
            'qte' => (int) $qty,
            'pu' => $hidePrices ? null : $pu,
            'pt' => $hidePrices ? null : $pt,
        ];
    }

    /**
     * @param  array<string, mixed>  $jalon
     * @return array<string, mixed>
     */
    private function formatJalonForfaitRow(array $jalon): array
    {
        $qty = (float) ($jalon['quantity'] ?? 1);
        if ($qty <= 0) {
            $qty = 1;
        } else {
            $qty = max(1, round($qty));
        }

        $unite = trim((string) ($jalon['unite'] ?? ''));
        if ($unite === '') {
            $unite = 'F';
        }

        if (array_key_exists('prix_unitaire_ht', $jalon)) {
            $pu = round(max(0, (float) $jalon['prix_unitaire_ht']), 2);
            $pt = round($qty * $pu, 2);
        } else {
            $pt = round(max(0, (float) ($jalon['montant_ht'] ?? 0)), 2);
            $pu = $pt;
            $qty = 1;
        }

        return [
            'type' => 'forfait_total',
            'label' => 'Prestation forfaitaire',
            'unite' => $unite,
            'qte' => (int) $qty,
            'pu' => $pu,
            'pt' => $pt,
        ];
    }

    /**
     * @param  array<int, true>  $seenLineIds
     * @return array{line: QuoteLine, index: int}|null
     */
    private function findLineByRefId(Collection $lines, int $refId, array $seenLineIds): ?array
    {
        foreach ($lines as $index => $line) {
            if (isset($seenLineIds[$line->id])) {
                continue;
            }
            if ((int) $line->ref_article_id === $refId) {
                return ['line' => $line, 'index' => $index];
            }
        }

        return null;
    }

    /**
     * @param  array<int, true>  $childRefIds
     * @param  array<int, true>  $seenLineIds
     * @return array{line: QuoteLine, index: int}|null
     */
    private function nextStandaloneLine(Collection $lines, array $seenLineIds, array $childRefIds): ?array
    {
        foreach ($lines as $index => $line) {
            if (isset($seenLineIds[$line->id])) {
                continue;
            }
            $refId = (int) ($line->ref_article_id ?? 0);
            if ($refId > 0 && isset($childRefIds[$refId])) {
                continue;
            }

            return ['line' => $line, 'index' => $index];
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatProductRow(QuoteLine $line, int $num, bool $maskPrice, bool $nested, bool $isForfait = false): array
    {
        $article = $line->refArticle;
        $details = $this->detailLinesFor(
            $line,
            $article?->description_commerciale ?? $article?->description ?? null,
        );

        $lineUnite = trim((string) ($line->unite ?? ''));
        if ($lineUnite === '') {
            $lineUnite = trim((string) ($article?->unite ?? ''));
        }
        if ($lineUnite === '') {
            $lineUnite = 'U';
        }

        $articleCode = trim((string) ($line->line_code ?? ''));
        if ($articleCode === '' && $article) {
            $articleCode = trim((string) ($article->code ?? $article->s2g_code ?? ''));
        }

        return [
            'type' => 'product',
            'nested' => $nested,
            'num' => '',
            'code' => $articleCode !== '' ? $articleCode : null,
            'label' => trim((string) $line->description),
            'unite' => $isForfait ? '' : $lineUnite,
            'qte' => $isForfait ? null : (int) $line->quantity,
            'pu' => ($maskPrice || $isForfait) ? null : (float) $line->unit_price,
            'pt' => ($maskPrice || $isForfait) ? null : (float) $line->total,
            'details' => $details,
        ];
    }

    /**
     * @return list<string>
     */
    private function detailLinesFor(QuoteLine $line, ?string $extraDescription): array
    {
        $chunks = [];
        $main = mb_strtolower(trim((string) $line->description));
        if (! $extraDescription) {
            return [];
        }

        foreach (preg_split('/\r?\n/', (string) $extraDescription) ?: [] as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            $normalized = mb_strtolower(trim($part, " \t\n\r\0\x0B.-"));
            if ($normalized === $main || in_array($normalized, self::DETAIL_SKIP, true)) {
                continue;
            }
            if (str_starts_with($normalized, 'description commerciale')
                || str_starts_with($normalized, 'description technique')) {
                continue;
            }
            $chunks[] = $part;
        }

        return array_values(array_unique($chunks));
    }
}
