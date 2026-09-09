<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonCommande;
use App\Models\BonLivraison;
use App\Models\DocumentPdfTemplate;
use App\Models\ExpenseReport;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Services\BonCommandePdfGenerator;
use App\Services\BonLivraisonPdfGenerator;
use App\Services\ExpenseReportPdfGenerator;
use App\Services\QuotePdfGenerator;
use App\Services\ReportService;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PdfController extends Controller
{
    /** @var list<string> */
    private const GENERATE_TYPES = [
        'quote',
        'invoice',
        'report',
        'purchase_order',
        'delivery_note',
        'expense_report',
    ];

    public function __construct(
        private ReportService $reportService,
        private QuotePdfGenerator $quotePdfGenerator,
        private BonCommandePdfGenerator $bonCommandePdfGenerator,
        private BonLivraisonPdfGenerator $bonLivraisonPdfGenerator,
        private ExpenseReportPdfGenerator $expenseReportPdfGenerator,
    ) {}

    public function templates(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $dbTemplates = DocumentPdfTemplate::query()
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('document_type')
            ->orderBy('name')
            ->get()
            ->map(fn (DocumentPdfTemplate $t) => [
                'id' => $t->id,
                'document_type' => $t->document_type,
                'slug' => $t->slug,
                'label' => $t->name,
                'name' => $t->name,
                'resource' => $t->document_type,
                'blade_view' => $t->blade_view,
                'is_default' => $t->is_default,
                'is_active' => $t->is_active,
            ]);

        return response()->json([
            'data' => collect(PdfTemplateResolver::DOCUMENT_TYPES)->map(fn (string $type) => [
                'id' => $type,
                'label' => $this->documentTypeLabel($type),
                'resource' => $type,
            ]),
            'document_templates' => $dbTemplates,
        ]);
    }

    public function generate(Request $request): StreamedResponse|JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'type' => 'required|in:'.implode(',', self::GENERATE_TYPES),
            'id' => 'required|integer',
            'template_id' => 'nullable|integer|exists:document_pdf_templates,id',
        ]);

        $type = $validated['type'];
        $id = (int) $validated['id'];
        $templateId = isset($validated['template_id']) ? (int) $validated['template_id'] : null;

        if ($templateId !== null) {
            $template = DocumentPdfTemplate::query()
                ->where('id', $templateId)
                ->where('document_type', $type)
                ->where('is_active', true)
                ->first();
            if (! $template) {
                return response()->json(['message' => 'Modèle PDF introuvable ou inactif pour ce type de document.'], 422);
            }
        }

        return match ($type) {
            'quote' => $this->streamQuotePdf($id, $templateId),
            'invoice' => $this->streamInvoicePdfById($id, $templateId),
            'report' => $this->streamReportPdf($id, $templateId),
            'purchase_order' => $this->streamPurchaseOrderPdf($id, $templateId),
            'delivery_note' => $this->streamDeliveryNotePdf($id, $templateId),
            'expense_report' => $this->streamExpenseReportPdf($id, $templateId),
            default => response()->json(['message' => 'Type PDF non pris en charge'], 422),
        };
    }

    private function streamQuotePdf(int $id, ?int $templateId): StreamedResponse|JsonResponse
    {
        $quote = Quote::find($id);
        if (! $quote) {
            return response()->json(['message' => 'Devis introuvable'], 404);
        }
        [$pdfBytes, $filename] = $this->quotePdfGenerator->generate($quote, $templateId);

        return response()->streamDownload(
            fn () => print($pdfBytes),
            $filename,
            ['Content-Type' => 'application/pdf']
        );
    }

    private function streamInvoicePdfById(int $id, ?int $templateId): StreamedResponse|JsonResponse
    {
        $invoice = Invoice::with(['client', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate'])->find($id);
        if (! $invoice) {
            return response()->json(['message' => 'Facture introuvable'], 404);
        }

        return $this->streamInvoicePdf($invoice, $templateId);
    }

    private function streamReportPdf(int $orderId, ?int $templateId): StreamedResponse|JsonResponse
    {
        $order = Order::find($orderId);
        if (! $order) {
            return response()->json(['message' => 'Commande introuvable'], 404);
        }
        $report = $this->reportService->generate($order, $templateId, null);

        return Storage::disk('local')->download(
            $report->file_path,
            $report->filename,
            ['Content-Type' => 'application/pdf']
        );
    }

    private function streamPurchaseOrderPdf(int $id, ?int $templateId): StreamedResponse|JsonResponse
    {
        $bc = BonCommande::find($id);
        if (! $bc) {
            return response()->json(['message' => 'Bon de commande introuvable'], 404);
        }
        [$pdfBytes, $filename] = $this->bonCommandePdfGenerator->generate($bc, $templateId);

        return response()->streamDownload(
            fn () => print($pdfBytes),
            $filename,
            ['Content-Type' => 'application/pdf']
        );
    }

    private function streamDeliveryNotePdf(int $id, ?int $templateId): StreamedResponse|JsonResponse
    {
        $bl = BonLivraison::find($id);
        if (! $bl) {
            return response()->json(['message' => 'Bon de livraison introuvable'], 404);
        }
        [$pdfBytes, $filename] = $this->bonLivraisonPdfGenerator->generate($bl, $templateId);

        return response()->streamDownload(
            fn () => print($pdfBytes),
            $filename,
            ['Content-Type' => 'application/pdf']
        );
    }

    private function streamExpenseReportPdf(int $id, ?int $templateId): StreamedResponse|JsonResponse
    {
        $report = ExpenseReport::find($id);
        if (! $report) {
            return response()->json(['message' => 'Note de frais introuvable'], 404);
        }
        [$pdfBytes, $filename] = $this->expenseReportPdfGenerator->generate($report, $templateId);

        return response()->streamDownload(
            fn () => print($pdfBytes),
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
        $template = PdfTemplateResolver::resolve('invoice', $requestTemplateId, $invoice->pdf_template_id);
        $view = $template?->blade_view ?? 'pdf.invoice';
        $layoutConfig = PdfTemplateResolver::layoutConfig($template);
        $html = view($view, [
            'invoice' => $invoice,
            'template' => $template,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'layoutConfig' => $layoutConfig,
            'currencyLabel' => 'DH',
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

    private function documentTypeLabel(string $type): string
    {
        return match ($type) {
            'quote' => 'Devis',
            'invoice' => 'Facture',
            'report' => 'Rapport d\'essais',
            'purchase_order' => 'Bon de commande',
            'delivery_note' => 'Bon de livraison',
            'expense_report' => 'Note de frais',
            default => $type,
        };
    }
}
