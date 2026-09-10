<?php

namespace Tests\Feature;

use App\Models\DocumentStatusDefinition;
use App\Models\User;
use App\Support\DocumentStatusCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentStatusDefinitionCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_user_can_list_document_status_definitions_by_type(): void
    {
        $user = User::factory()->create([
            'role' => 'lab_technician',
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/document-status-definitions?document_type=quote')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'document_type', 'code', 'label', 'sort_order', 'active']]]);

        $this->assertGreaterThanOrEqual(
            count(DocumentStatusCatalog::defaultStatuses()['quote']),
            DocumentStatusDefinition::query()->where('document_type', 'quote')->count()
        );
    }

    public function test_config_manager_can_create_update_and_delete_status(): void
    {
        $user = User::factory()->labAdmin()->create();

        $create = $this->actingAs($user, 'sanctum')
            ->postJson('/api/document-status-definitions', [
                'document_type' => 'quote',
                'code' => 'custom_test',
                'label' => 'Statut test',
                'sort_order' => 99,
                'is_initial' => false,
                'is_terminal' => false,
                'color_key' => 'teal',
                'active' => true,
            ])
            ->assertCreated()
            ->json();

        $id = $create['id'];

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/document-status-definitions/{$id}", [
                'label' => 'Statut test modifié',
                'active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('label', 'Statut test modifié')
            ->assertJsonPath('active', false);

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/document-status-definitions/{$id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('document_status_definitions', ['id' => $id]);
    }

    public function test_duplicate_code_is_rejected(): void
    {
        $user = User::factory()->labAdmin()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/document-status-definitions', [
                'document_type' => 'invoice',
                'code' => 'draft',
                'label' => 'Doublon',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Ce code existe déjà pour ce type de document.');
    }
}
