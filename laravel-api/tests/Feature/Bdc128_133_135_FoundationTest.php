<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\DocumentSequence;
use App\Models\DocumentStatusHistory;
use App\Models\Quote;
use App\Models\User;
use App\Services\DocumentSequenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Bdc128_133_135_FoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_admin_can_manage_client_contacts(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $client = Client::query()->create(['name' => 'Client test contacts']);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/clients/{$client->id}/contacts", [
                'prenom' => 'Jean',
                'nom' => 'Dupont',
                'poste' => 'Responsable',
                'email' => 'j.dupont@example.com',
                'is_principal' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('nom', 'Dupont');

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/clients/{$client->id}/contacts")
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_document_sequence_service_increments(): void
    {
        $s = new DocumentSequenceService;
        $a = $s->next(DocumentSequence::TYPE_DEVIS);
        $b = $s->next(DocumentSequence::TYPE_DEVIS);
        $this->assertNotSame($a, $b);
        $this->assertSame(2, (int) DocumentSequence::query()->where('type', DocumentSequence::TYPE_DEVIS)->value('last_number'));
    }

    public function test_quote_status_change_writes_document_status_history(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $client = Client::query()->create(['name' => 'Client test contacts']);
        $quote = Quote::query()->create([
            'number' => 'Q-TEST-1',
            'client_id' => $client->id,
            'quote_date' => now()->toDateString(),
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/quotes/{$quote->id}", [
                'status' => Quote::STATUS_VALIDATED,
            ])
            ->assertOk();

        $this->assertDatabaseHas('document_status_histories', [
            'document_type' => Quote::class,
            'document_id' => $quote->id,
            'etat_avant' => Quote::STATUS_DRAFT,
            'etat_apres' => Quote::STATUS_VALIDATED,
        ]);
    }

    public function test_document_status_histories_list_returns_rows(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $client = Client::query()->create(['name' => 'Client test contacts']);
        $quote = Quote::query()->create([
            'number' => 'Q-TEST-2',
            'client_id' => $client->id,
            'quote_date' => now()->toDateString(),
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
        ]);
        DocumentStatusHistory::query()->create([
            'document_type' => Quote::class,
            'document_id' => $quote->id,
            'etat_avant' => null,
            'etat_apres' => 'sent',
            'user_id' => $admin->id,
            'source' => DocumentStatusHistory::SOURCE_MANUEL,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/document-status-histories?'.http_build_query([
                'document_type' => Quote::class,
                'document_id' => $quote->id,
            ]))
            ->assertOk()
            ->assertJsonCount(1);
    }
}
