<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\DocumentSequence;
use App\Models\Site;
use App\Models\User;
use App\Services\DocumentSequenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientFilialeDocumentNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_document_sequence_includes_filiale_trigram(): void
    {
        $service = new DocumentSequenceService;
        $number = $service->next(DocumentSequence::TYPE_DEVIS, 'PAR');

        $this->assertMatchesRegularExpression('/^DEV-\d{4}-\d{4}\/PAR$/', $number);
    }

    public function test_document_sequences_are_separate_per_filiale(): void
    {
        $service = new DocumentSequenceService;
        $par = $service->next(DocumentSequence::TYPE_DEVIS, 'PAR');
        $lyo = $service->next(DocumentSequence::TYPE_DEVIS, 'LYO');

        $this->assertStringEndsWith('/PAR', $par);
        $this->assertStringEndsWith('/LYO', $lyo);
        $this->assertSame('DEV-'.now()->format('Y').'-0001/PAR', $par);
        $this->assertSame('DEV-'.now()->format('Y').'-0001/LYO', $lyo);
    }

    public function test_lab_admin_quote_uses_site_filiale_trigram(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $client = Client::query()->create(['name' => 'Client filiale test']);
        $filiale = Agency::query()->create([
            'client_id' => $client->id,
            'name' => 'Paris',
            'code' => 'PAR',
            'is_headquarters' => true,
        ]);
        $site = Site::query()->create([
            'client_id' => $client->id,
            'agency_id' => $filiale->id,
            'name' => 'Chantier Paris',
            'status' => 'not_started',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/quotes', [
            'client_id' => $client->id,
            'site_id' => $site->id,
            'filiale_agency_id' => $filiale->id,
            'quote_date' => now()->toDateString(),
            'lines' => [
                [
                    'description' => 'Essai',
                    'quantity' => 1,
                    'unit_price' => 100,
                ],
            ],
        ]);

        $response->assertCreated();
        $number = (string) $response->json('number');
        $this->assertMatchesRegularExpression('/^DEV-\d{4}-\d{4}\/PAR$/', $number);
        $this->assertSame($filiale->id, (int) $response->json('meta.filiale_agency_id'));
    }
}
