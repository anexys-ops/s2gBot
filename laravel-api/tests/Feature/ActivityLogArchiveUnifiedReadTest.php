<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ActivityLogArchiveUnifiedReadTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_unified_read_merges_live_and_archive(): void
    {
        ActivityLog::query()->create([
            'user_id' => null,
            'action' => 'live.event',
            'subject_type' => null,
            'subject_id' => null,
            'properties' => ['x' => 1],
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subHour(),
        ]);

        DB::table('activity_logs_archive')->insert([
            'original_id' => 999,
            'user_id' => null,
            'action' => 'archived.event',
            'subject_type' => null,
            'subject_id' => null,
            'properties' => json_encode(['y' => 2]),
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subHours(2),
            'archived_at' => now()->subDay(),
        ]);

        $admin = User::factory()->labAdmin()->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/activity-logs?include=archive&per_page=10');

        $response->assertOk();
        $actions = collect($response->json('data'))->pluck('action')->all();
        $this->assertContains('live.event', $actions);
        $this->assertContains('archived.event', $actions);
        $this->assertArrayHasKey('next_cursor', $response->json('meta'));
    }

    public function test_non_admin_forbidden_on_admin_activity_logs(): void
    {
        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($tech, 'sanctum')
            ->getJson('/api/admin/activity-logs?include=archive')
            ->assertForbidden();
    }

    public function test_cursor_returns_next_page_slice(): void
    {
        for ($i = 0; $i < 5; $i++) {
            ActivityLog::query()->create([
                'user_id' => null,
                'action' => 'evt-'.$i,
                'subject_type' => null,
                'subject_id' => null,
                'properties' => null,
                'ip_address' => null,
                'created_at' => now()->subSeconds(2000 - $i * 10),
            ]);
        }

        $admin = User::factory()->labAdmin()->create();

        $first = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/activity-logs?include=archive&per_page=2');
        $first->assertOk();
        $cursor = $first->json('meta.next_cursor');
        $this->assertNotNull($cursor, json_encode($first->json()));

        $second = $this->actingAs($admin, 'sanctum')->getJson(
            '/api/admin/activity-logs?include=archive&per_page=2&cursor_created_at='.urlencode($cursor['cursor_created_at']).'&cursor_id='.$cursor['cursor_id']
        );
        $second->assertOk();
        $this->assertLessThanOrEqual(2, count($second->json('data')));
    }
}
