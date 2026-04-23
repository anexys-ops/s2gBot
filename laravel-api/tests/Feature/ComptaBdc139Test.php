<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComptaBdc139Test extends TestCase
{
    use RefreshDatabase;

    private function seedClientWithAgency(): Client
    {
        $client = Client::query()->create(['name' => 'Compta test']);
        Agency::query()->create([
            'client_id' => $client->id,
            'name' => 'Siège',
            'is_headquarters' => true,
        ]);

        return $client;
    }

    public function test_lab_creates_reglement_with_invoice(): void
    {
        $client = $this->seedClientWithAgency();
        $aid = (int) Agency::query()->where('client_id', $client->id)->value('id');
        $inv = Invoice::query()->create([
            'number' => 'FAC-TEST-1',
            'client_id' => $client->id,
            'agency_id' => $aid,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(7)->toDateString(),
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Invoice::STATUS_SENT,
        ]);
        $lab = User::factory()->labAdmin()->create();

        $r = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/reglements', [
            'client_id' => $client->id,
            'invoice_id' => $inv->id,
            'amount_ttc' => 120,
            'payment_mode' => 'virement',
            'payment_date' => now()->toDateString(),
        ]);
        $r->assertCreated();
        $r->assertJsonPath('numero', 'REG-2026-0001');
    }

    public function test_lab_creates_invoice_credit(): void
    {
        $client = $this->seedClientWithAgency();
        $aid = (int) Agency::query()->where('client_id', $client->id)->value('id');
        $inv = Invoice::query()->create([
            'number' => 'FAC-AV-1',
            'client_id' => $client->id,
            'agency_id' => $aid,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(7)->toDateString(),
            'amount_ht' => 200,
            'amount_ttc' => 240,
            'tva_rate' => 20,
            'status' => Invoice::STATUS_SENT,
        ]);
        $lab = User::factory()->labAdmin()->create();
        $r = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/invoice-credits', [
            'client_id' => $client->id,
            'source_invoice_id' => $inv->id,
            'amount_ttc' => 50,
            'reason' => 'Erreur de facturation',
        ]);
        $r->assertCreated();
        $r->assertJsonPath('numero', 'AVO-2026-0001');
    }
}
