<?php

namespace Tests\Feature;

use App\Models\BonCommande;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\OrdreMission;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FraisDeplacementExpenseUnificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_om_frais_create_persists_expense_report_and_line(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $client = Client::query()->create(['name' => 'Client NDF']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier NDF']);
        $dossier = Dossier::query()->create([
            'reference'  => 'DOS-NDF-001',
            'titre'      => 'Dossier NDF',
            'client_id'  => $client->id,
            'site_id'    => $site->id,
            'statut'     => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-09-01',
            'created_by' => $user->id,
        ]);
        $quote = Quote::query()->create([
            'number'     => 'DEV-NDF-001',
            'client_id'  => $client->id,
            'quote_date' => '2026-09-01',
            'amount_ht'  => 100,
            'amount_ttc' => 120,
            'status'     => Quote::STATUS_DRAFT,
        ]);
        $bc = BonCommande::query()->create([
            'numero'        => 'BC-NDF-001',
            'quote_id'      => $quote->id,
            'dossier_id'    => $dossier->id,
            'client_id'     => $client->id,
            'statut'        => BonCommande::STATUT_BROUILLON,
            'date_commande' => '2026-09-02',
            'montant_ht'    => 100,
            'montant_ttc'   => 120,
            'created_by'    => $user->id,
        ]);
        $om = OrdreMission::query()->create([
            'numero'          => 'OM-T-2026-0099',
            'bon_commande_id' => $bc->id,
            'client_id'       => $client->id,
            'dossier_id'      => $dossier->id,
            'type'            => OrdreMission::TYPE_TECHNICIEN,
            'statut'          => OrdreMission::STATUT_PLANIFIE,
            'date_prevue'     => '2026-09-09',
            'responsable_id'  => $user->id,
        ]);

        $response = $this->postJson("/api/ordres-mission/{$om->id}/frais", [
            'type'           => 'deplacement',
            'user_id'        => $user->id,
            'date'           => '2026-09-09',
            'lieu_depart'    => 'casa',
            'lieu_arrivee'   => 'casa',
            'distance_km'    => 20,
            'taux_km'        => 0.401,
            'type_transport' => 'voiture',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('montant', 16.04);
        $response->assertJsonPath('ndf_statut', ExpenseReport::STATUT_BROUILLON);

        $this->assertDatabaseCount('expense_reports', 1);
        $this->assertDatabaseCount('expense_lines', 1);
        $this->assertFalse(Schema::hasTable('frais_deplacement'));

        $line = ExpenseLine::query()->first();
        $this->assertSame('Voyage', $line->category);
        $this->assertSame(20.0, (float) $line->distance_km);

        $this->getJson('/api/expense-reports')
            ->assertOk()
            ->assertJsonPath('data.0.ordre_mission_id', $om->id);
    }
}
