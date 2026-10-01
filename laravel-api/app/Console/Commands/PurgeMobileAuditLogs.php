<?php

namespace App\Console\Commands;

use App\Models\MobileAuditLog;
use Illuminate\Console\Command;

class PurgeMobileAuditLogs extends Command
{
    protected $signature = 'mobile-audit:purge {--days=90 : Jours de conservation minimum}';

    protected $description = 'Supprime les entrées du journal d’audit mobile plus anciennes que la rétention (90 jours par défaut, traçabilité)';

    public function handle(): int
    {
        $days = max(90, (int) $this->option('days'));
        $cutoff = now()->subDays($days);

        $deleted = MobileAuditLog::query()->where('occurred_at', '<', $cutoff)->delete();

        $this->info("Purge audit mobile > {$days} j (avant {$cutoff->toDateTimeString()}) — {$deleted} ligne(s)");

        return self::SUCCESS;
    }
}
