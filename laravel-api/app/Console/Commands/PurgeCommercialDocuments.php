<?php

namespace App\Console\Commands;

use App\Services\CommercialDocumentsPurgeService;
use Illuminate\Console\Command;

class PurgeCommercialDocuments extends Command
{
    protected $signature = 'documents:purge-commercial
                            {--dry-run : Afficher les volumes sans supprimer}
                            {--force : Confirmer la suppression (obligatoire hors dry-run)}
                            {--no-reset-sequences : Conserver les compteurs de numérotation}';

    protected $description = 'Supprime tous les devis, BC, BL, factures, réceptions labo (échantillons) et ordres de mission';

    public function handle(CommercialDocumentsPurgeService $purgeService): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $resetSequences = ! $this->option('no-reset-sequences');

        if (! $dryRun && ! $this->option('force')) {
            $this->error('Opération destructive : ajoutez --force pour confirmer, ou --dry-run pour simuler.');

            return self::FAILURE;
        }

        if (! $dryRun && ! $this->option('no-interaction')) {
            if (! $this->confirm(
                'Supprimer TOUS les devis, BC, BL, factures, échantillons labo et ODM en base ?',
                false
            )) {
                $this->warn('Annulé.');

                return self::SUCCESS;
            }
        }

        $this->warn($dryRun
            ? 'Mode simulation — aucune donnée ne sera supprimée.'
            : 'Suppression en cours…');

        $counts = $purgeService->purge($dryRun, $resetSequences);

        $rows = collect($counts)
            ->map(fn (int $count, string $label) => [$label, $count])
            ->sortByDesc(fn (array $row) => $row[1])
            ->values()
            ->all();

        $this->table(['Élément', 'Lignes'], $rows);

        $total = array_sum($counts);
        $this->info($dryRun
            ? "Simulation terminée — {$total} ligne(s) seraient affectées."
            : "Purge terminée — {$total} opération(s) enregistrées.");

        return self::SUCCESS;
    }
}
