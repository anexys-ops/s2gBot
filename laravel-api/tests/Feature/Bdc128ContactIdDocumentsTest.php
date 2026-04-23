<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\ClientContact;
use App\Models\Dossier;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Bdc128ContactIdDocumentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejects_contact_from_wrong_client_on_quote_update(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null]);
        $c1 = Client::query()->create(['name' => 'A']);
        $c2 = Client::query()->create(['name' => 'B']);
        $contactB = ClientContact::query()->create([
            'client_id' => $c2->id,
            'prenom' => 'x',
            'nom' => 'y',
            'is_principal' => false,
        ]);
        $quote = Quote::query()->create([
            'number' => 'Q-TEST-128',
            'client_id' => $c1->id,
            'quote_date' => now()->toDateString(),
            'amount_ht' => 10,
            'amount_ttc' => 12,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/quotes/{$quote->id}", [
                'contact_id' => $contactB->id,
            ])
            ->assertStatus(422);
    }

    public function test_transform_bc_copies_contact_id_from_signed_quote(): void
    {
        $client = Client::query()->create(['name' => 'C']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'S']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2099-0128',
            'titre' => 'D',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $cc = ClientContact::query()->create([
            'client_id' => $client->id,
            'prenom' => 'C',
            'nom' => 'Cto',
            'is_principal' => true,
        ]);
        $q = Quote::query()->create([
            'number' => 'Q-BC-128',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'contact_id' => $cc->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $q->id,
            'description' => 'L1',
            'quantity' => 1,
            'unit_price' => 100,
            'tva_rate' => 20,
            'total' => 100,
        ]);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/v1/devis/{$q->id}/transformer-bc")
            ->assertCreated();

        $this->assertSame($cc->id, (int) $res->json('contact_id'));
    }
}
