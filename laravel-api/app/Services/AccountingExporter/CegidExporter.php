<?php

namespace App\Services\AccountingExporter;

use App\Models\Invoice;
use Illuminate\Support\Collection;

/**
 * Export type écritures (colonnes génériques importables CEGID / outils intermédiaires).
 */
final class CegidExporter
{
    /**
     * @param  Collection<int, Invoice>  $invoices
     * @param  array<string, string>  $accounts
     */
    public function toCsv(Collection $invoices, array $accounts): string
    {
        $accClient = $accounts['account_client'] ?? '411000';
        $accVat = $accounts['account_vat'] ?? '445710';
        $accSales = $accounts['account_sales'] ?? '701000';

        $lines = [];
        $lines[] = implode(';', ['Code journal', 'Date', 'Compte', 'Libellé', 'Sens', 'Montant', 'Référence']);

        foreach ($invoices as $inv) {
            $date = $inv->invoice_date?->format('Ymd') ?? '';
            $ref = $inv->number;
            $lib = 'Facture '.$inv->number;
            $ttc = round((float) $inv->amount_ttc, 2);
            $ht = round((float) $inv->amount_ht, 2);
            $tva = round($ttc - $ht, 2);

            $lines[] = implode(';', ['VT', $date, $accClient, $lib, 'D', $this->num($ttc), $ref]);
            $lines[] = implode(';', ['VT', $date, $accSales, $lib.' HT', 'C', $this->num($ht), $ref]);
            $lines[] = implode(';', ['VT', $date, $accVat, $lib.' TVA', 'C', $this->num($tva), $ref]);
        }

        return "\xEF\xBB\xBF".implode("\n", $lines)."\n";
    }

    private function num(float $n): string
    {
        return number_format($n, 2, ',', '');
    }
}
