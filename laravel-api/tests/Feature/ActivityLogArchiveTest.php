<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ActivityLogArchiveTest extends TestCase
{
    use RefreshDatabase;

    public function test_archive_moves_old_rows(): void
    {
        ActivityLog::query()->create([
            'user_id' => null,
            'action' => 'test.archive',
            'subject_type' => null,
            'subject_id' => null,
            'properties' => ['x' => 1],
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDays(120),
        ]);

        $this->artisan('logs:archive --older-than=90')->assertSuccessful();

        $this->assertSame(0, ActivityLog::query()->count());
        $this->assertSame(1, DB::table('activity_logs_archive')->count());
    }
}
