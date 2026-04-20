<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeActivityLogsArchive extends Command
{
    protected $signature = 'logs:purge-archive {--older-than=730 : Jours de conservation dans l’archive}';

    protected $description = 'Supprime définitivement les lignes activity_logs_archive trop anciennes';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('older-than'));
        $cutoff = now()->subDays($days);

        $deleted = DB::table('activity_logs_archive')->where('archived_at', '<', $cutoff)->delete();
        $this->info("Supprimé {$deleted} ligne(s) d’archive.");

        return self::SUCCESS;
    }
}
