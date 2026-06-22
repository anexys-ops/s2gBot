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
     * @return list<array<string, mixed>>
     */
    public function buildItemRows(Quote $quote): array
    {
        $meta = is_array($quote->meta) ? $quote->meta : [];
        $jalons = $meta['devis_jalons'] ?? [];
        $parcours = $meta['devis_parcours'] ?? [];
        $maskPrices = $meta['ligne_masque_prix_pdf'] ?? [];

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
                    foreach ($jalon['product_ref_article_ids'] ?? [] as $refId) {
                        $entry = $this->findLineByRefId($lines, (int) $refId, $seenLineIds);
                        if ($entry === null) {
                            continue;
                        }
                        $mask = ($maskPrices[$entry['index']] ?? false) === true;
                        $rows[] = $this->formatProductRow($entry['line'], ++$itemNum, $mask);
                        $seenLineIds[$entry['line']->id] = true;
                    }

                    continue;
                }

                if ($kind === 'ligne') {
                    $entry = $this->nextStandaloneLine($lines, $seenLineIds, $childRefIds);
                    if ($entry === null) {
                        continue;
                    }
                    $mask = ($maskPrices[$entry['index']] ?? false) === true;
                    $rows[] = $this->formatProductRow($entry['line'], ++$itemNum, $mask);
                    $seenLineIds[$entry['line']->id] = true;
                }
            }
        } elseif ($jalons !== []) {
            foreach ($jalons as $jalon) {
                foreach ($jalon['product_ref_article_ids'] ?? [] as $refId) {
                    $entry = $this->findLineByRefId($lines, (int) $refId, $seenLineIds);
                    if ($entry === null) {
                        continue;
                    }
                    $mask = ($maskPrices[$entry['index']] ?? false) === true;
                    $rows[] = $this->formatProductRow($entry['line'], ++$itemNum, $mask);
                    $seenLineIds[$entry['line']->id] = true;
                }
            }
        }

        foreach ($lines as $index => $line) {
            if (isset($seenLineIds[$line->id])) {
                continue;
            }
            $mask = ($maskPrices[$index] ?? false) === true;
            $rows[] = $this->formatProductRow($line, ++$itemNum, $mask);
            $seenLineIds[$line->id] = true;
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
     * Produit seul (hors jalon) — ordre des lignes du devis.
     *
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
    private function formatProductRow(QuoteLine $line, int $num, bool $maskPrice): array
    {
        $article = $line->refArticle;
        $details = $this->detailLinesFor(
            $line,
            $article?->description_commerciale ?? $article?->description ?? null,
        );

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
