<?php

namespace App\Console\Commands;

use App\Models\Sample;
use App\Services\LabTaskSampleLinker;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class LinkLabTaskSamples extends Command
{
    protected $signature = 'samples:link-lab-tasks';

    protected $description = 'Rattache les FOLD terrain existants (non rattachés) aux tâches laboratoire de leur jalon';

    public function handle(LabTaskSampleLinker $linker): int
    {
        $links = 0;
        Sample::query()
            ->whereNotNull('task_id')
            ->whereNotNull('bon_commande_ligne_id')
            ->whereDoesntHave('labTasks')
            ->whereNotIn('status', [Sample::STATUS_ANNULE, Sample::STATUS_PERDU, Sample::STATUS_REJETE])
            ->orderBy('id')
            ->each(function (Sample $sample) use ($linker, &$links) {
                $links += DB::transaction(fn () => $linker->linkSample($sample));
            });

        $this->info("{$links} rattachement(s) FOLD → tâche labo créé(s).");

        return self::SUCCESS;
    }
}
