<?php

namespace App\Services;

use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\OrdreMission;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class ExpenseReportService
{
    public function firstOrCreateForOrdreMission(OrdreMission $ordreMission, ?int $createdBy = null): ExpenseReport
    {
        return ExpenseReport::query()->firstOrCreate(
            ['ordre_mission_id' => $ordreMission->id],
            [
                'statut'     => ExpenseReport::STATUT_BROUILLON,
                'created_by' => $createdBy ?? Auth::id(),
            ],
        );
    }

    /** @return Builder<ExpenseLine> */
    public function deplacementLinesQuery(ExpenseReport $report): Builder
    {
        return ExpenseLine::query()
            ->where('expense_report_id', $report->id)
            ->where('category', 'Voyage')
            ->whereNotNull('distance_km');
    }

    public function computeDeplacementAmount(float $distanceKm, float $tauxKm): float
    {
        return round(max(0, $distanceKm) * max(0, $tauxKm) * 2, 2);
    }

    public function buildDeplacementDescription(
        ?string $lieuDepart,
        ?string $lieuArrivee,
        ?string $notes = null,
    ): string {
        if ($notes !== null && trim($notes) !== '') {
            return trim($notes);
        }

        $trajet = trim(implode(' → ', array_filter([$lieuDepart, $lieuArrivee])));

        return $trajet !== '' ? "Déplacement {$trajet}" : 'Déplacement kilométrique';
    }

    /**
     * @return array<string, mixed>
     */
    public function deplacementLineToFraisPayload(ExpenseLine $line, ExpenseReport $report): array
    {
        $line->loadMissing('user:id,name');

        return [
            'id'                    => $line->id,
            'ordre_mission_id'      => $report->ordre_mission_id,
            'expense_report_id'     => $report->id,
            'expense_report_number' => $report->unique_number,
            'ndf_statut'            => $report->statut,
            'user_id'               => $line->user_id,
            'date'                  => $line->date?->format('Y-m-d'),
            'lieu_depart'           => $line->lieu_depart,
            'lieu_arrivee'          => $line->lieu_arrivee,
            'distance_km'           => (float) ($line->distance_km ?? 0),
            'taux_km'               => (float) ($line->taux_km ?? 0),
            'montant'               => (float) $line->amount,
            'type_transport'        => $line->type_transport ?? 'voiture',
            'notes'                 => $line->description,
            'statut'                => $this->legacyStatutFromReport($report->statut),
            'user'                  => $line->user,
        ];
    }

    public function legacyStatutFromReport(string $reportStatut): string
    {
        return match ($reportStatut) {
            ExpenseReport::STATUT_VALIDE    => 'valide',
            ExpenseReport::STATUT_REMBOURSE => 'rembourse',
            default                         => 'draft',
        };
    }

    public function buildEmailBody(ExpenseReport $report): string
    {
        $report->loadMissing(['ordreMission.client', 'ordreMission.dossier', 'ordreMission.site', 'lines.user']);
        $om = $report->ordreMission;
        $lines = $report->lines ?? collect();
        $total = (float) ($report->total ?? $lines->sum('amount'));
        $advance = (float) ($report->advance_amount ?? 0);
        $net = max(0, $total - $advance);

        $rows = $lines->map(function (ExpenseLine $line) {
            $validated = $line->is_validated ? '✓' : '○';
            $desc = trim((string) ($line->description ?? ''));

            return sprintf(
                "%s | %s | %s | %s | %s %s",
                $line->date?->format('d/m/Y') ?? '—',
                $line->category,
                number_format((float) $line->amount, 2, ',', ' '),
                $line->payment_method ?? '—',
                $validated,
                $desc !== '' ? "— {$desc}" : '',
            );
        })->implode("\n");

        $context = array_filter([
            $om?->unique_number ?? $om?->numero,
            $om?->dossier?->reference ?? $om?->dossier?->titre,
            $om?->client?->name,
            $om?->site?->name,
        ]);

        return implode("\n", array_filter([
            "Note de frais {$report->unique_number}",
            'Statut : '.$report->statut,
            'Contexte : '.implode(' · ', $context),
            '',
            'Date | Catégorie | Montant | Paiement | Validé',
            $rows !== '' ? $rows : '(aucune ligne)',
            '',
            'Total TTC : '.number_format($total, 2, ',', ' '),
            $advance > 0 ? 'Acompte versé : '.number_format($advance, 2, ',', ' ') : null,
            $advance > 0 ? 'Net à rembourser : '.number_format($net, 2, ',', ' ') : null,
            $report->notes ? "\nNotes :\n".$report->notes : null,
        ]));
    }

    public function assertDeplacementLineBelongsToOrdreMission(
        ExpenseLine $line,
        OrdreMission $ordreMission,
    ): ExpenseReport {
        $line->loadMissing('expenseReport');
        $report = $line->expenseReport;
        abort_if($report === null, 404);
        abort_if((int) $report->ordre_mission_id !== (int) $ordreMission->id, 404);
        abort_if(! $line->isDeplacement(), 404);

        return $report;
    }
}
