<?php

namespace App\Services;

use App\Models\BcLignePlanningAffectation;
use App\Models\MissionTask;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;

class TerrainPlanningPdfGenerator
{
    public function __construct(private readonly TerrainPlanningMissionTasksService $missionTasks) {}

    /**
     * @return array{0: string, 1: string}
     */
    public function generate(
        string $from,
        string $to,
        ?int $userId = null,
        ?int $requestTemplateId = null,
    ): array {
        $template = PdfTemplateResolver::resolve('terrain_planning', $requestTemplateId, null);
        $layoutConfig = PdfTemplateResolver::layoutConfig($template);

        $query = BcLignePlanningAffectation::query()
            ->with([
                'bonCommandeLigne.bonCommande.client',
                'bonCommandeLigne.bonCommande.dossier',
                'user',
            ])
            ->whereDate('date_debut', '<=', $to)
            ->whereDate('date_fin', '>=', $from);

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $affectations = $query
            ->orderBy('date_debut')
            ->orderBy('user_id')
            ->orderBy('id')
            ->get()
            ->concat($this->missionTasks->scheduled($from, $to, $userId))
            ->sortBy(fn ($row) => $row instanceof MissionTask
                ? $row->planned_date?->format('Y-m-d')
                : $row->date_debut?->format('Y-m-d'))
            ->values();

        $isDaily = $from === $to;
        $title = $isDaily ? 'Programme journalier' : 'Programme hebdomadaire';
        $periodLabel = $isDaily
            ? $this->formatDate($from)
            : 'Du '.$this->formatDate($from).' au '.$this->formatDate($to);

        $html = view($template?->blade_view ?? 'pdf.terrain_planning', [
            'template' => $template,
            'layoutConfig' => $layoutConfig,
            'brandingLogoDataUri' => AppBranding::logoDataUriForPdf(),
            'affectations' => $affectations,
            'title' => $title,
            'periodLabel' => $periodLabel,
            'generatedAt' => now()->format('d/m/Y H:i'),
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'landscape');

        $suffix = $isDaily ? $from : $from.'_'.$to;

        return [$pdf->output(), 'programme-terrain-'.$suffix.'.pdf'];
    }

    private function formatDate(string $value): string
    {
        return CarbonImmutable::parse($value)->format('d/m/Y');
    }
}
