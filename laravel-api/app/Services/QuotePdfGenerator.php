<?php

namespace App\Services;

use App\Models\DocumentPdfTemplate;
use App\Models\Quote;
use App\Support\AppBranding;
use App\Support\FrenchAmountInWords;
use Barryvdh\DomPDF\Facade\Pdf;

class QuotePdfGenerator
{
    public function __construct(
        private readonly QuotePdfPresentationService $presentation,
    ) {}

    /**
     * @return array{0: string, 1: string} PDF binary and download filename
     */
    public function generate(Quote $quote): array
    {
        $quote->loadMissing([
            'client',
            'site',
            'dossier',
            'quoteLines.refArticle',
            'quoteLines.commercialOffering.equipment',
            'billingAddress',
            'deliveryAddress',
            'pdfTemplate',
        ]);

        $template = $this->resolvePdfTemplate('quote', null, $quote->pdf_template_id);
        $view = $template?->blade_view ?? 'pdf.quote';
        $layoutConfig = AppBranding::mergeLayoutConfig($template?->layout_config);
        $pdfContext = $this->presentation->buildContext($quote);
        $itemRows = $this->presentation->buildItemRows($quote);
        $amountInWords = FrenchAmountInWords::format($pdfContext['total_ttc']);

        $html = view($view, [
            'quote' => $quote,
            'template' => $template,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'letterheadDataUri' => AppBranding::devisLetterheadDataUriForPdf(),
            'layoutConfig' => $layoutConfig,
            'pdfContext' => $pdfContext,
            'itemRows' => $itemRows,
            'amountInWords' => $amountInWords,
            'currencyLabel' => 'DH',
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        return [$pdf->output(), 'devis-' . $quote->number . '.pdf'];
    }

    private function resolvePdfTemplate(string $documentType, ?int $requestTemplateId, ?int $modelTemplateId): ?DocumentPdfTemplate
    {
        if ($requestTemplateId) {
            return DocumentPdfTemplate::query()
                ->where('id', $requestTemplateId)
                ->where('document_type', $documentType)
                ->first();
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
