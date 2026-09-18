<?php

namespace App\Services;

use App\Models\RapportBC;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;

class RapportBCPdfGenerator
{
    /**
     * @return array{0: string, 1: string}
     */
    public function generate(RapportBC $rapport, ?int $requestTemplateId = null): array
    {
        $template = PdfTemplateResolver::resolve('rapport_bc', $requestTemplateId, null);
        $layoutConfig = PdfTemplateResolver::layoutConfig($template);
        $view = $template?->blade_view ?? 'pdf.rapport_bc';

        $rapport->loadMissing([
            'bonCommande.client',
            'bonCommande.dossier.site',
            'createdBy',
            'versions.uploadedByUser',
            'suivis.user',
            'taches.assignedUser',
        ]);

        $html = view($view, [
            'rapport'             => $rapport,
            'template'            => $template,
            'layoutConfig'        => $layoutConfig,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        $filename = 'rapport-'.$rapport->numero.'.pdf';

        return [$pdf->output(), $filename];
    }
}
