<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;

class BonCommandePdfGenerator
{
    /**
     * @return array{0: string, 1: string}
     */
    public function generate(BonCommande $bonCommande, ?int $requestTemplateId = null): array
    {
        $bonCommande->loadMissing(['client', 'dossier', 'quote', 'lignes.article']);

        $template = PdfTemplateResolver::resolve('purchase_order', $requestTemplateId, null);
        $layoutConfig = PdfTemplateResolver::layoutConfig($template);
        $view = $template?->blade_view ?? 'pdf.purchase_order';

        $html = view($view, [
            'bonCommande' => $bonCommande,
            'template' => $template,
            'layoutConfig' => $layoutConfig,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'currencyLabel' => 'DH',
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        return [$pdf->output(), 'bc-'.$bonCommande->numero.'.pdf'];
    }
}
