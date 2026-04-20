<?php

namespace App\Services\AccountingExporter;

use App\Models\Invoice;
use Illuminate\Support\Collection;

final class SageExporter
{
    /**
     * @param  Collection<int, Invoice>  $invoices
     * @param  array<string, string>  $accounts
     */
    public function toCsv(Collection $invoices, array $accounts): string
    {
        $journal = $accounts['journal_code'] ?? 'VT';
        $accClient = $accounts['account_client'] ?? '411000';
        $accVat = $accounts['account_vat'] ?? '445710';
        $accSales = $accounts['account_sales'] ?? '701000';

        $lines = [];
        $lines[] = implode(';', ['Journal', 'Date', 'N° compte', 'Libellé', 'Débit', 'Crédit', 'N° pièce']);

        foreach ($invoices as $inv) {
            $date = $inv->invoice_date?->format('Y-m-d') ?? '';
            $piece = $inv->number;
            $label = 'Facture '.$inv->number;
            $ttc = round((float) $inv->amount_ttc, 2);
            $ht = round((float) $inv->amount_ht, 2);
            $tva = round($ttc - $ht, 2);

            $lines[] = implode(';', [$journal, $date, $accClient, $label, $this->num($ttc), '', $piece]);
            $lines[] = implode(';', [$journal, $date, $accSales, $label.' HT', '', $this->num($ht), $piece]);
            $lines[] = implode(';', [$journal, $date, $accVat, $label.' TVA', '', $this->num($tva), $piece]);
        }

        return implode("\n", $lines)."\n";
    }

    private function num(float $n): string
    {
        return number_format($n, 2, '.', '');
    }
}
