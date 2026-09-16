<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Dossier;
use App\Models\LabCentreGroup;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LabCentreGroupQuoteAndBcTest extends TestCase
{
    use RefreshDatabase;

    private function makeDossier(Client $client, Site $site, User $lab, ?LabCentreGroup $centre = null): Dossier
    {
        return Dossier::query()->create([
            'reference' => 'DOS-2099-'.random_int(1000, 9999),
            'titre' => 'D centre test',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'lab_centre_group_id' => $centre?->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
    }

    public function test_quote_store_defaults_centre_from_dossier(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create(['name' => 'Centre Auto Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site auto']);
        $centre = LabCentreGroup::query()->create(['code' => 'MO', 'name' => 'Mohammedia']);
        $dossier = $this->makeDossier($client, $site, $lab, $centre);

        $response = $this->actingAs($lab, 'sanctum')->postJson('/api/quotes', [
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'quote_date' => now()->toDateString(),
            'lines' => [
                ['description' => 'Essai', 'quantity' => 1, 'unit_price' => 100],
            ],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('lab_centre_group_id', $centre->id);
        $response->assertJsonPath('centre_group.code', 'MO');
    }

    public function test_quote_store_honors_explicit_centre_over_dossier_default(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create(['name' => 'Centre Explicit Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site explicit']);
        $dossierCentre = LabCentreGroup::query()->create(['code' => 'MO', 'name' => 'Mohammedia']);
        $chosenCentre = LabCentreGroup::query()->create(['code' => 'CA', 'name' => 'Casablanca']);
        $dossier = $this->makeDossier($client, $site, $lab, $dossierCentre);

        $response = $this->actingAs($lab, 'sanctum')->postJson('/api/quotes', [
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'lab_centre_group_id' => $chosenCentre->id,
            'quote_date' => now()->toDateString(),
            'lines' => [
                ['description' => 'Essai', 'quantity' => 1, 'unit_price' => 100],
            ],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('lab_centre_group_id', $chosenCentre->id);
    }

    public function test_quote_update_changes_centre(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create(['name' => 'Centre Update Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site update']);
        $centreA = LabCentreGroup::query()->create(['code' => 'MO', 'name' => 'Mohammedia']);
        $centreB = LabCentreGroup::query()->create(['code' => 'CA', 'name' => 'Casablanca']);

        $quote = Quote::query()->create([
            'number' => 'Q-CENTRE-UPDATE',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'lab_centre_group_id' => $centreA->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->putJson("/api/quotes/{$quote->id}", [
            'lab_centre_group_id' => $centreB->id,
        ]);

        $response->assertOk();
        $response->assertJsonPath('lab_centre_group_id', $centreB->id);
    }

    public function test_bc_created_from_quote_carries_its_centre(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create(['name' => 'Centre BC Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site BC']);
        $centre = LabCentreGroup::query()->create(['code' => 'MO', 'name' => 'Mohammedia']);
        $dossier = $this->makeDossier($client, $site, $lab, $centre);

        $quote = Quote::query()->create([
            'number' => 'Q-CENTRE-BC',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'lab_centre_group_id' => $centre->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'description' => 'Essai',
            'quantity' => 1,
            'unit_price' => 100,
            'tva_rate' => 20,
            'total' => 100,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/devis/{$quote->id}/transformer-bc");

        $response->assertCreated();
        $response->assertJsonPath('lab_centre_group_id', $centre->id);
        $response->assertJsonPath('centre_group.code', 'MO');
    }

    public function test_bc_update_changes_centre(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create(['name' => 'Centre BC Update Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site BC update']);
        $centreA = LabCentreGroup::query()->create(['code' => 'MO', 'name' => 'Mohammedia']);
        $centreB = LabCentreGroup::query()->create(['code' => 'CA', 'name' => 'Casablanca']);
        $dossier = $this->makeDossier($client, $site, $lab, $centreA);

        $quote = Quote::query()->create([
            'number' => 'Q-CENTRE-BC-UPDATE',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'lab_centre_group_id' => $centreA->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'description' => 'Essai',
            'quantity' => 1,
            'unit_price' => 100,
            'tva_rate' => 20,
            'total' => 100,
        ]);

        $bcId = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/v1/devis/{$quote->id}/transformer-bc")
            ->assertCreated()
            ->json('id');

        $response = $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-commande/{$bcId}", [
            'lab_centre_group_id' => $centreB->id,
        ]);

        $response->assertOk();
        $response->assertJsonPath('lab_centre_group_id', $centreB->id);
        $response->assertJsonPath('centre_group.code', 'CA');
    }
}
