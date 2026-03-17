<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PdfController extends Controller
{
    public function __construct(
        private ReportService $reportService
    ) {}

    public function templates(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json([
            'data' => [
                ['id' => 'quote', 'label' => 'Devis', 'resource' => 'quote'],
                ['id' => 'invoice', 'label' => 'Facture', 'resource' => 'invoice'],
                ['id' => 'report', 'label' => 'Rapport d\'essais', 'resource' => 'order'],
            ],
        ]);
    }

    public function generate(Request $request): StreamedResponse|JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'type' => 'required|in:quote,invoice,report',
            'id' => 'required|integer',
        ]);

        $type = $validated['type'];
        $id = (int) $validated['id'];

        if ($type === 'quote') {
            $quote = Quote::with(['client', 'site', 'quoteLines'])->find($id);
            if (! $quote) {
                return response()->json(['message' => 'Devis introuvable'], 404);
            }
            $html = view('pdf.quote', ['quote' => $quote])->render();
            $filename = 'devis-'.$quote->number.'.pdf';
        } elseif ($type === 'invoice') {
            $invoice = Invoice::with(['client', 'invoiceLines'])->find($id);
            if (! $invoice) {
                return response()->json(['message' => 'Facture introuvable'], 404);
            }
            $html = view('pdf.invoice', ['invoice' => $invoice])->render();
            $filename = 'facture-'.$invoice->number.'.pdf';
        } else {
            $order = Order::find($id);
            if (! $order) {
                return response()->json(['message' => 'Commande introuvable'], 404);
            }
            $report = $this->reportService->generate($order);
            return Storage::disk('local')->download(
                $report->file_path,
                $report->filename,
                ['Content-Type' => 'application/pdf']
            );
        }

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        return response()->streamDownload(
            fn () => print($pdf->output()),
            $filename,
            ['Content-Type' => 'application/pdf']
        );
    }
}
