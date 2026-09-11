<?php

namespace App\Services;

use App\Models\ExpenseReport;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;

class ExpenseReportPdfGenerator
{
    /**
     * @return array{0: string, 1: string}
     */
    public function generate(ExpenseReport $report, ?int $requestTemplateId = null): array
    {
        $report->loadMissing([
            'ordreMission.client',
            'ordreMission.dossier',
            'ordreMission.site',
            'lines.user',
            'createdBy',
            'validatedBy',
        ]);
        $report->append('total');

        $template = PdfTemplateResolver::resolve('expense_report', $requestTemplateId, null);
        $layoutConfig = PdfTemplateResolver::layoutConfig($template);
        $view = $template?->blade_view ?? 'pdf.expense_report';

        $html = view($view, [
            'report'              => $report,
            'template'            => $template,
            'layoutConfig'        => $layoutConfig,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'currencyLabel'       => config('app.currency_display', 'DH'),
            'paymentLabels'       => [
                'especes'  => 'Espèces',
                'cb'       => 'Carte bancaire',
                'virement' => 'Virement',
                'cheque'   => 'Chèque',
                'autre'    => 'Autre',
            ],
            'statutLabels' => [
                'brouillon' => 'Brouillon',
                'soumis'    => 'Soumis',
                'valide'    => 'Validé',
                'rembourse' => 'Remboursé',
                'rejete'    => 'Rejeté',
            ],
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');

        return [$pdf->output(), 'ndf-'.$report->unique_number.'.pdf'];
    }
}
