<?php

namespace App\Console\Commands;

use App\Models\Sample;
use App\Services\LabTaskSampleLinker;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class LinkLabTaskSamples extends Command
{
    protected $signature = 'samples:link-lab-tasks';

    protected $description = 'Relie les échantillons à leur mission terrain et rattache les FOLD non rattachés aux tâches laboratoire de leur jalon';

    public function handle(LabTaskSampleLinker $linker): int
    {
        $links = 0;
        $inferred = 0;
        Sample::query()
            ->whereNull('task_id')
            ->whereNotNull('bon_commande_ligne_id')
            ->whereNotIn('status', [Sample::STATUS_ANNULE, Sample::STATUS_PERDU, Sample::STATUS_REJETE])
            ->orderBy('id')
            ->each(function (Sample $sample) use ($linker, &$inferred) {
                // Échantillons réceptionnés depuis la ligne de BC : retrouver leur mission terrain (PV).
                if ($taskId = $linker->inferTerrainTaskId((int) $sample->bon_commande_ligne_id)) {
                    $sample->update(['task_id' => $taskId]);
                    $inferred++;
                }
            });

        Sample::query()
            ->whereNotNull('bon_commande_ligne_id')
            ->whereDoesntHave('labTasks')
            ->whereNotIn('status', [Sample::STATUS_ANNULE, Sample::STATUS_PERDU, Sample::STATUS_REJETE])
            ->orderBy('id')
            ->each(function (Sample $sample) use ($linker, &$links) {
                $links += DB::transaction(fn () => $linker->linkSample($sample));
            });

        $this->info("{$inferred} échantillon(s) relié(s) à leur mission terrain, {$links} rattachement(s) FOLD → tâche labo créé(s).");

        return self::SUCCESS;
    }
}
