<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\BcLignePlanningAffectation;
use App\Models\Dossier;
use App\Models\Equipment;
use App\Models\ExpenseReport;
use App\Models\MaterielAffectation;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MobileTerrainApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_mobile_routes_require_authentication_and_are_listed_in_openapi(): void
    {
        $this->getJson('/api/mobile/terrain/tasks')->assertUnauthorized();
        $this->getJson('/api/openapi.json')->assertOk()
            ->assertJsonStructure(['paths' => ['/mobile/terrain/calendar', '/mobile/terrain/tasks', '/mobile/terrain/expense-reports']]);
    }

    public function test_mobile_terrain_returns_only_my_calendar_tasks_client_and_equipment(): void
    {
        [$user, $other, $om] = $this->seedMission();
        $mine = $this->taskFor($om, $user, 'Ma tâche');
        $theirs = $this->taskFor($om, $other, 'Autre tâche');
        $equipment = Equipment::query()->create(['name' => 'Densitomètre', 'code' => 'MAT-1', 'type' => 'Essai', 'status' => 'active']);
        MaterielAffectation::query()->create([
            'equipment_id' => $equipment->id,
            'ordre_mission_id' => $om->id,
            'dossier_id' => $om->dossier_id,
            'user_id' => $user->id,
            'date_debut' => '2026-09-22',
            'date_retour_prevue' => '2026-09-24',
        ]);
        $bcLine = BonCommandeLigne::query()->create([
            'bon_commande_id' => $om->bon_commande_id, 'libelle' => 'Ancienne affectation',
            'ordre' => 1, 'quantite' => 1, 'quantite_devis' => 1,
            'prix_unitaire_ht' => 0, 'tva_rate' => 20, 'montant_ht' => 0,
        ]);
        BcLignePlanningAffectation::query()->create([
            'bon_commande_ligne_id' => $bcLine->id, 'user_id' => $user->id,
            'date_debut' => '2026-09-22', 'date_fin' => '2026-09-22', 'created_by' => $user->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/mobile/terrain/calendar?from=2026-09-22&to=2026-09-28')
            ->assertOk()->assertJsonCount(1, 'tasks')->assertJsonPath('tasks.0.id', $mine->id)
            ->assertJsonPath('events.0.source_type', 'terrain_bc')
            ->assertJsonPath('events.0.client.name', 'Client mobile')
            ->assertJsonPath('equipment_movements.0.equipment.code', 'MAT-1');
        $this->getJson('/api/mobile/terrain/tasks')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $mine->id);
        $this->getJson('/api/mobile/terrain/tasks/'.$mine->id)
            ->assertOk()->assertJsonPath('client.name', 'Client mobile')->assertJsonPath('equipment.0.a_recuperer_le', '2026-09-22')
            ->assertJsonPath('equipment.0.a_deposer_le', '2026-09-24');
        $this->getJson('/api/mobile/terrain/tasks/'.$theirs->id)->assertForbidden();
    }

    public function test_mobile_expense_reports_are_limited_to_assigned_missions_and_owner(): void
    {
        [$user, $other, $om] = $this->seedMission();
        $this->taskFor($om, $user, 'Ma tâche');
        $otherReport = ExpenseReport::query()->create([
            'ordre_mission_id' => $om->id,
            'user_id' => $other->id,
            'created_by' => $other->id,
            'statut' => ExpenseReport::STATUT_BROUILLON,
        ]);
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/mobile/terrain/expense-options')->assertOk()->assertJsonCount(1, 'ordres_mission');
        $this->getJson('/api/mobile/terrain/expense-reports')->assertOk()->assertJsonCount(0);
        $this->postJson('/api/mobile/terrain/expense-reports/'.$otherReport->id.'/lines', [
            'category' => 'Repas', 'date' => '2026-09-22', 'amount' => 90,
        ])->assertForbidden();

        $reportId = $this->postJson('/api/mobile/terrain/expense-reports', ['ordre_mission_id' => $om->id])
            ->assertCreated()->assertJsonPath('user_id', $user->id)->json('id');
        $this->postJson('/api/mobile/terrain/expense-reports/'.$reportId.'/lines', [
            'category' => 'Repas', 'date' => '2026-09-22', 'amount' => 90,
        ])->assertCreated()->assertJsonPath('user_id', $user->id);
        $this->postJson('/api/mobile/terrain/expense-reports/'.$reportId.'/submit')
            ->assertOk()->assertJsonPath('statut', ExpenseReport::STATUT_SOUMIS);
    }

    private function seedMission(): array
    {
        $client = Client::query()->create(['name' => 'Client mobile', 'phone' => '+212600000000']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier mobile']);
        $user = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN]);
        $other = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-MOBILE', 'titre' => 'Dossier mobile', 'client_id' => $client->id,
            'site_id' => $site->id, 'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-09-01', 'created_by' => $user->id,
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-MOBILE', 'dossier_id' => $dossier->id, 'client_id' => $client->id,
            'statut' => BonCommande::STATUT_CONFIRME, 'date_commande' => '2026-09-01',
            'montant_ht' => 100, 'montant_ttc' => 120, 'tva_rate' => 20, 'created_by' => $user->id,
        ]);
        $om = OrdreMission::query()->create([
            'numero' => 'OM-T-MOBILE', 'bon_commande_id' => $bc->id, 'dossier_id' => $dossier->id, 'client_id' => $client->id,
            'site_id' => $site->id, 'type' => OrdreMission::TYPE_TECHNICIEN,
            'statut' => OrdreMission::STATUT_PLANIFIE, 'created_by' => $user->id,
        ]);

        return [$user, $other, $om];
    }

    private function taskFor(OrdreMission $om, User $user, string $label): \App\Models\MissionTask
    {
        $line = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $om->id, 'libelle' => $label, 'quantite' => 1,
            'assigned_user_id' => $user->id, 'date_prevue' => '2026-09-22', 'ordre' => 1,
        ]);

        return $line->ensureTaskExists();
    }
}
