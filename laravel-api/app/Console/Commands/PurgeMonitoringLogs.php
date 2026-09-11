<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\SecurityLog;
use App\Models\SystemErrorLog;
use App\Models\UserSessionPresence;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PurgeMonitoringLogs extends Command
{
    protected $signature = 'monitoring:purge {--days= : Jours de rétention (défaut: config monitoring.retention_days)}';

    protected $description = 'Supprime les journaux d’activité, erreurs et sécurité plus anciens que la rétention configurée';

    public function handle(): int
    {
        $days = $this->option('days') !== null
            ? max(1, (int) $this->option('days'))
            : (int) config('monitoring.retention_days', 7);

        $cutoff = now()->subDays($days);
        $counts = [];

        $counts['activity_logs'] = ActivityLog::query()
            ->where('created_at', '<', $cutoff)
            ->delete();

        if (Schema::hasTable('activity_logs_archive')) {
            $counts['activity_logs_archive'] = DB::table('activity_logs_archive')
                ->where('created_at', '<', $cutoff)
                ->delete();
        }

        if (Schema::hasTable('system_error_logs')) {
            $counts['system_error_logs'] = SystemErrorLog::query()
                ->where('created_at', '<', $cutoff)
                ->delete();
        }

        if (Schema::hasTable('security_logs')) {
            $counts['security_logs'] = SecurityLog::query()
                ->where('created_at', '<', $cutoff)
                ->delete();
        }

        if (Schema::hasTable('user_session_presence')) {
            $counts['user_session_presence'] = UserSessionPresence::query()
                ->where('last_seen_at', '<', $cutoff)
                ->delete();
        }

        $total = array_sum($counts);
        $detail = collect($counts)
            ->filter(fn (int $n) => $n > 0)
            ->map(fn (int $n, string $table) => "{$table}: {$n}")
            ->implode(', ');

        $this->info("Purge > {$days} j (avant {$cutoff->toDateTimeString()}) — {$total} ligne(s)".($detail !== '' ? " [{$detail}]" : ''));

        return self::SUCCESS;
    }
}
