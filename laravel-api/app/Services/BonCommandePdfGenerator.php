<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;

class BonCommandePdfGenerator
{
    public function __construct(
        private BonCommandePdfPresentationService $presentation,
    ) {}

    /**
     * @return array{0: string, 1: string}
     */
    public function generate(BonCommande $bonCommande, ?int $requestTemplateId = null): array
    {
        $template = PdfTemplateResolver::resolve('purchase_order', $requestTemplateId, null);
        $layoutConfig = PdfTemplateResolver::layoutConfig($template);
        $view = $template?->blade_view ?? 'pdf.purchase_order';
        $isDossierRecap = $view === 'pdf.purchase_order_dossier_recap';

        $bonCommande->loadMissing(['client', 'dossier', 'quote', 'lignes.article']);
        if ($isDossierRecap) {
            $bonCommande->loadMissing([
                'clientContact',
                'createur',
                'dossier.site',
                'dossier.contacts',
                'dossier.mission',
                'lignes.article.famille',
            ]);
        }

        $html = view($view, [
            'bonCommande' => $bonCommande,
            'template' => $template,
            'layoutConfig' => $layoutConfig,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'currencyLabel' => \App\Support\MoneyFormat::currencyLabel($bonCommande->quote?->currency_code),
            'pdfContext' => $isDossierRecap ? $this->presentation->buildContext($bonCommande) : [],
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        $filename = $isDossierRecap
            ? 'bc-recap-'.$bonCommande->numero.'.pdf'
            : 'bc-'.$bonCommande->numero.'.pdf';

        return [$pdf->output(), $filename];
    }
}
