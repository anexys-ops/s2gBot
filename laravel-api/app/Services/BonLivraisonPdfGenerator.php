<?php

namespace App\Services;

use App\Models\BonLivraison;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;

class BonLivraisonPdfGenerator
{
    /**
     * @return array{0: string, 1: string}
     */
    public function generate(BonLivraison $bonLivraison, ?int $requestTemplateId = null): array
    {
        $bonLivraison->loadMissing(['client', 'bonCommande.quote', 'lignes.bonCommandeLigne']);

        $template = PdfTemplateResolver::resolve('delivery_note', $requestTemplateId, null);
        $layoutConfig = PdfTemplateResolver::layoutConfig($template);
        $view = $template?->blade_view ?? 'pdf.delivery_note';

        $html = view($view, [
            'bonLivraison' => $bonLivraison,
            'template' => $template,
            'layoutConfig' => $layoutConfig,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'currencyLabel' => \App\Support\MoneyFormat::currencyLabel($bonLivraison->bonCommande?->quote?->currency_code),
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        return [$pdf->output(), 'bl-'.$bonLivraison->numero.'.pdf'];
    }
}
