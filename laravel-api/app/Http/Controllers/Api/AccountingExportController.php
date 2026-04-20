<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\ModuleSetting;
use App\Services\AccountingExporter\CegidExporter;
use App\Services\AccountingExporter\SageExporter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountingExportController extends Controller
{
    public function export(Request $request): StreamedResponse|\Illuminate\Http\JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'format' => 'required|in:sage,cegid',
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $accountsRow = ModuleSetting::query()->where('module_key', 'accounting_export')->value('settings') ?? [];
        $accounts = is_array($accountsRow) ? $accountsRow : [];

        $invoices = Invoice::query()
            ->whereBetween('invoice_date', [$validated['from'], $validated['to']])
            ->orderBy('invoice_date')
            ->orderBy('id')
            ->get();

        if ($validated['format'] === 'sage') {
            $csv = (new SageExporter)->toCsv($invoices, $accounts);
            $filename = 'export-sage-'.$validated['from'].'-'.$validated['to'].'.csv';
        } else {
            $csv = (new CegidExporter)->toCsv($invoices, $accounts);
            $filename = 'export-cegid-'.$validated['from'].'-'.$validated['to'].'.csv';
        }

        return response()->streamDownload(
            static function () use ($csv) {
                echo $csv;
            },
            $filename,
            [
                'Content-Type' => 'text/csv; charset=UTF-8',
            ]
        );
    }
}
