<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeActivityLogsArchive extends Command
{
    protected $signature = 'logs:purge-archive
                            {--older-than=730 : Jours de conservation dans l’archive (basé sur archived_at)}
                            {--older-than-years= : Années de conservation (prioritaire si défini, ex. 2)}';

    protected $description = 'Supprime définitivement les lignes activity_logs_archive trop anciennes';

    public function handle(): int
    {
        $yearsOpt = $this->option('older-than-years');
        if ($yearsOpt !== null && $yearsOpt !== '') {
            $days = max(1, (int) $yearsOpt) * 365;
        } else {
            $days = max(1, (int) $this->option('older-than'));
        }
        $cutoff = now()->subDays($days);

        $deleted = DB::table('activity_logs_archive')->where('archived_at', '<', $cutoff)->delete();
        $this->info("Supprimé {$deleted} ligne(s) d’archive.");

        return self::SUCCESS;
    }
}
