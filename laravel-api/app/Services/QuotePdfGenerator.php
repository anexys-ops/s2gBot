<?php

namespace App\Services;

use App\Models\DocumentPdfTemplate;
use App\Models\Quote;
use App\Support\AppBranding;
use App\Support\FrenchAmountInWords;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;

class QuotePdfGenerator
{
    public function __construct(
        private readonly QuotePdfPresentationService $presentation,
        private readonly CommercialPdfCache $pdfCache,
    ) {}

    /**
     * @return array{0: string, 1: string} PDF binary and download filename
     */
    public function generate(Quote $quote, ?int $requestTemplateId = null): array
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

        $template = PdfTemplateResolver::resolve('quote', $requestTemplateId, $quote->pdf_template_id);
        $cacheKey = $this->pdfCache->keyForDocument(
            'quote',
            (int) $quote->id,
            $template?->id,
            $quote->updated_at?->getTimestamp() ?? 0,
            $template?->updated_at?->getTimestamp() ?? 0,
        );

        return $this->pdfCache->remember($cacheKey, function () use ($quote, $template) {
            $view = $template?->blade_view ?? 'pdf.quote';
            $layoutConfig = PdfTemplateResolver::layoutConfig($template);
            $pdfContext = $this->presentation->buildContext($quote);
            $itemRows = $this->presentation->buildItemRows($quote, $layoutConfig);
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
                'currencyLabel' => \App\Support\MoneyFormat::currencyLabel($quote->currency_code),
            ])->render();

            $pdf = Pdf::loadHTML($html);
            $pdf->getDomPDF()->setPaper('A4', 'portrait');

            return [$pdf->output(), 'devis-'.$quote->number.'.pdf'];
        });
    }
}
