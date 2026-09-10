<?php

namespace App\Services;

use App\Models\Invoice;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoicePdfGenerator
{
    /**
     * @return array{0: string, 1: string} PDF binary and download filename
     */
    public function generate(Invoice $invoice, ?int $requestTemplateId = null): array
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
            'currencyLabel' => \App\Support\MoneyFormat::currencyLabel($invoice->currency_code),
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        return [$pdf->output(), 'facture-'.$invoice->number.'.pdf'];
    }
}
