<?php

namespace App\Services;

use App\Models\Dossier;
use App\Support\AppBranding;
use Barryvdh\DomPDF\Facade\Pdf;

class DossierPdfGenerator
{
    /**
     * @return array{0: string, 1: string}
     */
    public function generate(Dossier $dossier): array
    {
        $dossier->loadMissing([
            'client',
            'site',
            'mission',
            'centreGroup',
            'createur',
            'contacts',
            'quotes',
        ]);

        $html = view('pdf.dossier_fiche', [
            'dossier' => $dossier,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        $filename = 'dossier-'.str_replace(['/', '\\'], '-', $dossier->reference).'.pdf';

        return [$pdf->output(), $filename];
    }
}
