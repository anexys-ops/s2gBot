<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentPdfTemplate;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Services\ReportService;
use App\Support\AppBranding;
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

        $dbTemplates = DocumentPdfTemplate::query()
            ->orderBy('document_type')
            ->orderBy('name')
            ->get()
            ->map(fn (DocumentPdfTemplate $t) => [
                'id' => (string) $t->id,
                'slug' => $t->slug,
                'label' => $t->name,
                'resource' => $t->document_type,
                'blade_view' => $t->blade_view,
                'is_default' => $t->is_default,
            ]);

        return response()->json([
            'data' => [
                ['id' => 'quote', 'label' => 'Devis (alias)', 'resource' => 'quote'],
                ['id' => 'invoice', 'label' => 'Facture (alias)', 'resource' => 'invoice'],
                ['id' => 'report', 'label' => 'Rapport d\'essais', 'resource' => 'order'],
            ],
            'document_templates' => $dbTemplates,
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
            'template_id' => 'nullable|integer|exists:document_pdf_templates,id',
        ]);

        $type = $validated['type'];
        $id = (int) $validated['id'];

        if ($type === 'quote') {
            $quote = Quote::with(['client', 'site', 'quoteLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate'])->find($id);
            if (! $quote) {
                return response()->json(['message' => 'Devis introuvable'], 404);
            }
            $template = $this->resolvePdfTemplate('quote', $validated['template_id'] ?? null, $quote->pdf_template_id);
            $view = $template?->blade_view ?? 'pdf.quote';
            $layoutConfig = AppBranding::mergeLayoutConfig($template?->layout_config);
            $html = view($view, [
                'quote' => $quote,
                'template' => $template,
                'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
                'layoutConfig' => $layoutConfig,
            ])->render();
            $filename = 'devis-'.$quote->number.'.pdf';
        } elseif ($type === 'invoice') {
            $invoice = Invoice::with(['client', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate'])->find($id);
            if (! $invoice) {
                return response()->json(['message' => 'Facture introuvable'], 404);
            }

            return $this->streamInvoicePdf($invoice, $validated['template_id'] ?? null);
        } else {
            $order = Order::find($id);
            if (! $order) {
                return response()->json(['message' => 'Commande introuvable'], 404);
            }
            $report = $this->reportService->generate($order, null, null);
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

    /**
     * Génère le PDF facture (utilisé par POST /pdf/generate et par l’URL signée portail client).
     */
    public function streamInvoicePdf(Invoice $invoice, ?int $requestTemplateId = null): StreamedResponse
    {
        $invoice->loadMissing(['client', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate']);
        $template = $this->resolvePdfTemplate('invoice', $requestTemplateId, $invoice->pdf_template_id);
        $view = $template?->blade_view ?? 'pdf.invoice';
        $layoutConfig = AppBranding::mergeLayoutConfig($template?->layout_config);
        $html = view($view, [
            'invoice' => $invoice,
            'template' => $template,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'layoutConfig' => $layoutConfig,
        ])->render();
        $filename = 'facture-'.$invoice->number.'.pdf';

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        return response()->streamDownload(
            fn () => print($pdf->output()),
            $filename,
            ['Content-Type' => 'application/pdf']
        );
    }

    private function resolvePdfTemplate(string $documentType, ?int $requestTemplateId, ?int $modelTemplateId): ?DocumentPdfTemplate
    {
        if ($requestTemplateId) {
            $t = DocumentPdfTemplate::query()
                ->where('id', $requestTemplateId)
                ->where('document_type', $documentType)
                ->first();

            return $t;
        }

        if ($modelTemplateId) {
            $t = DocumentPdfTemplate::find($modelTemplateId);
            if ($t && $t->document_type === $documentType) {
                return $t;
            }
        }

        return DocumentPdfTemplate::query()
            ->where('document_type', $documentType)
            ->where('is_default', true)
            ->first();
    }
}
