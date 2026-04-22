<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WorkflowDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkflowDefinitionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_admin_can_list_workflow_definitions(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);
        WorkflowDefinition::query()->create([
            'code' => 'devis_std',
            'name' => 'Devis standard',
            'document_type' => 'quote',
            'active' => true,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/workflow-definitions')
            ->assertOk()
            ->assertJsonPath('0.code', 'devis_std');
    }

    public function test_client_cannot_list_workflow_definitions(): void
    {
        $client = User::factory()->create([
            'role' => User::ROLE_CLIENT,
        ]);

        $this->actingAs($client, 'sanctum')
            ->getJson('/api/v1/workflow-definitions')
            ->assertForbidden();
    }
}
