<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ArchiveActivityLogs extends Command
{
    protected $signature = 'logs:archive {--older-than=90 : Jours après lesquels archiver}';

    protected $description = 'Déplace les entrées activity_logs anciennes vers activity_logs_archive';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('older-than'));
        $cutoff = now()->subDays($days);

        $moved = 0;
        ActivityLog::query()
            ->where('created_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById(250, function ($logs) use (&$moved) {
                $ids = [];
                foreach ($logs as $log) {
                    $ids[] = $log->id;
                    DB::table('activity_logs_archive')->insert([
                        'original_id' => $log->id,
                        'user_id' => $log->user_id,
                        'action' => $log->action,
                        'subject_type' => $log->subject_type,
                        'subject_id' => $log->subject_id,
                        'properties' => $log->properties !== null ? json_encode($log->properties) : null,
                        'ip_address' => $log->ip_address,
                        'created_at' => $log->created_at,
                        'archived_at' => now(),
                    ]);
                }
                ActivityLog::query()->whereIn('id', $ids)->delete();
                $moved += count($ids);
            });

        $this->info("Archivé {$moved} ligne(s).");

        return self::SUCCESS;
    }
}
