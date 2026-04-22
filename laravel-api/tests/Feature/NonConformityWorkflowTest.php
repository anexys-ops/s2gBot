<?php

namespace Tests\Feature;

use App\Models\CorrectiveAction;
use App\Models\NonConformity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NonConformityWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_non_conformities(): void
    {
        $this->getJson('/api/non-conformities')->assertUnauthorized();
    }

    public function test_lab_creates_non_conformity_and_corrective_action_then_closes(): void
    {
        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $create = $this->actingAs($tech, 'sanctum')->postJson('/api/non-conformities', [
            'detected_at' => now()->toIso8601String(),
            'detected_by' => $tech->id,
            'sample_id' => null,
            'equipment_id' => null,
            'order_id' => null,
            'severity' => NonConformity::SEVERITY_MAJOR,
            'description' => 'Écart sur paramètre granulométrie.',
            'status' => NonConformity::STATUS_OPEN,
        ]);

        $create->assertCreated();
        $create->assertJsonPath('reference', 'NC-'.now()->format('Y').'-00001');
        $ncId = (int) $create->json('id');

        $addAction = $this->actingAs($tech, 'sanctum')->postJson("/api/non-conformities/{$ncId}/corrective-actions", [
            'title' => 'Revue méthode + formation opérateur',
            'responsible_user_id' => $tech->id,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => CorrectiveAction::STATUS_PENDING,
        ]);
        $addAction->assertCreated();
        $actionId = (int) $addAction->json('id');

        $this->actingAs($tech, 'sanctum')
            ->patchJson("/api/corrective-actions/{$actionId}", [
                'status' => CorrectiveAction::STATUS_VERIFIED,
                'verification_notes' => 'Action vérifiée en revue qualité.',
            ])
            ->assertOk();

        $this->actingAs($tech, 'sanctum')
            ->patchJson("/api/non-conformities/{$ncId}", [
                'status' => NonConformity::STATUS_CLOSED,
            ])
            ->assertOk()
            ->assertJsonPath('status', NonConformity::STATUS_CLOSED);

        $stats = $this->actingAs($tech, 'sanctum')->getJson('/api/non-conformities/stats');
        $stats->assertOk();
        $stats->assertJsonPath('closed', 1);
    }

    public function test_list_and_show_load_relations(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/non-conformities', [
            'detected_at' => now()->toIso8601String(),
            'detected_by' => $admin->id,
            'severity' => NonConformity::SEVERITY_MINOR,
            'description' => 'Test liste',
            'status' => NonConformity::STATUS_ANALYZING,
        ])->assertCreated();

        $list = $this->actingAs($admin, 'sanctum')->getJson('/api/non-conformities');
        $list->assertOk();
        $this->assertCount(1, $list->json());

        $id = $list->json('0.id');
        $show = $this->actingAs($admin, 'sanctum')->getJson("/api/non-conformities/{$id}");
        $show->assertOk();
        $show->assertJsonPath('reference', 'NC-'.now()->format('Y').'-00001');
    }
}
