<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LabCentreGroupApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_admin_creates_updates_and_deletes_a_centre_group(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/lab-centre-groups', [
            'code' => 'MO',
            'name' => 'Mohammedia',
        ]);
        $create->assertCreated();
        $create->assertJsonPath('code', 'MO');
        $id = (int) $create->json('id');

        $list = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/lab-centre-groups');
        $list->assertOk();
        $list->assertJsonFragment(['code' => 'MO']);

        $update = $this->actingAs($admin, 'sanctum')->putJson("/api/v1/lab-centre-groups/{$id}", [
            'name' => 'Mohammedia Centre',
        ]);
        $update->assertOk();
        $update->assertJsonPath('name', 'Mohammedia Centre');

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/lab-centre-groups/{$id}")->assertNoContent();
    }

    public function test_non_admin_cannot_create_a_centre_group(): void
    {
        $tech = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN, 'client_id' => null, 'site_id' => null]);

        $this->actingAs($tech, 'sanctum')->postJson('/api/v1/lab-centre-groups', [
            'code' => 'MO',
            'name' => 'Mohammedia',
        ])->assertForbidden();
    }
}
