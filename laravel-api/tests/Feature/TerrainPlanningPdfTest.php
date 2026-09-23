<?php

namespace Tests\Feature;

use App\Models\BcLignePlanningAffectation;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TerrainPlanningPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_can_generate_daily_terrain_planning_pdf_with_default_template(): void
    {
        [$lab, $technician, $line] = $this->seedPlanningRow();

        BcLignePlanningAffectation::query()->create([
            'bon_commande_ligne_id' => $line->id,
            'user_id' => $technician->id,
            'date_debut' => '2026-09-22',
            'date_fin' => '2026-09-22',
            'notes' => 'Prévenir le chef de chantier avant le départ.',
            'created_by' => $lab->id,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/planning-terrain/pdf', [
            'from' => '2026-09-22',
            'to' => '2026-09-22',
            'user_id' => $technician->id,
        ]);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringStartsWith('application/pdf', (string) $response->headers->get('content-type'));
        ob_start();
        $response->sendContent();
        $pdfBytes = (string) ob_get_clean();
        $this->assertStringStartsWith('%PDF-', $pdfBytes);
        $this->assertDatabaseHas('document_pdf_templates', [
            'document_type' => 'terrain_planning',
            'slug' => 'planning-terrain-classique',
            'is_default' => true,
        ]);
    }

    public function test_client_cannot_generate_internal_terrain_planning_pdf(): void
    {
        $clientUser = User::factory()->create(['role' => User::ROLE_CLIENT]);

        $this->actingAs($clientUser, 'sanctum')->postJson('/api/v1/planning-terrain/pdf', [
            'from' => '2026-09-22',
            'to' => '2026-09-28',
        ])->assertForbidden();
    }

    public function test_planning_context_separates_laboratory_engineering_and_terrain_tasks(): void
    {
        [$lab, $technician, $line] = $this->seedPlanningRow();
        $laboratoryTask = $this->seedMissionTask($line, $lab, $technician, OrdreMission::TYPE_LABO, 'OM-L-TEST', '2026-09-22');
        $engineeringTask = $this->seedMissionTask($line, $lab, $technician, OrdreMission::TYPE_INGENIEUR, 'OM-I-TEST', '2026-09-22');
        $pendingTask = $this->seedMissionTask($line, $lab, null, OrdreMission::TYPE_LABO, 'OM-L-PENDING', null);

        $query = '?from=2026-09-22&to=2026-09-28';
        $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/planning-terrain'.$query.'&context=labo')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.mission_task_id', $laboratoryTask->id)
            ->assertJsonPath('0.client_name', 'Client planning PDF')
            ->assertJsonPath('0.dossier_reference', 'DOS-PLANNING-PDF');
        $this->getJson('/api/v1/planning-terrain'.$query.'&context=ingenieur')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.mission_task_id', $engineeringTask->id);
        $this->getJson('/api/v1/planning-terrain'.$query)
            ->assertOk()->assertJsonCount(0);
        $this->getJson('/api/v1/planning-terrain'.$query.'&context=labo&undated=1')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.mission_task_id', $pendingTask->id);

        $this->postJson('/api/v1/planning-terrain/pdf', [
            'from' => '2026-09-22',
            'to' => '2026-09-22',
            'context' => 'ingenieur',
        ])->assertOk()->assertHeader('content-disposition', 'attachment; filename=programme-ingenierie-2026-09-22.pdf');
    }

    private function seedMissionTask(BonCommandeLigne $bcLine, User $creator, ?User $assignee, string $type, string $numero, ?string $date): \App\Models\MissionTask
    {
        $bc = $bcLine->bonCommande;
        $om = OrdreMission::query()->create([
            'numero' => $numero,
            'bon_commande_id' => $bc->id,
            'dossier_id' => $bc->dossier_id,
            'client_id' => $bc->client_id,
            'site_id' => $bc->dossier->site_id,
            'type' => $type,
            'statut' => OrdreMission::STATUT_PLANIFIE,
            'created_by' => $creator->id,
        ]);
        $omLine = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $om->id,
            'bon_commande_ligne_id' => $bcLine->id,
            'libelle' => 'Contrôle de compacité',
            'quantite' => 1,
            'assigned_user_id' => $assignee?->id,
            'date_prevue' => $date,
            'ordre' => 1,
        ]);

        return $omLine->ensureTaskExists();
    }

    /** @return array{User, User, BonCommandeLigne} */
    private function seedPlanningRow(): array
    {
        $client = Client::query()->create(['name' => 'Client planning PDF']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier planning']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $technician = User::factory()->create([
            'name' => 'Technicien Terrain',
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-PLANNING-PDF',
            'titre' => 'Programme terrain',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-09-01',
            'created_by' => $lab->id,
        ]);
        $order = BonCommande::query()->create([
            'numero' => 'BCC-PLANNING-PDF',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_CONFIRME,
            'date_commande' => '2026-09-01',
            'montant_ht' => 300,
            'montant_ttc' => 360,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        $line = BonCommandeLigne::query()->create([
            'bon_commande_id' => $order->id,
            'libelle' => 'Contrôle de compacité sur plateforme',
            'ordre' => 1,
            'quantite' => 3,
            'quantite_devis' => 3,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'montant_ht' => 300,
            'notes_ligne' => 'Apporter le densitomètre.',
        ]);

        return [$lab, $technician, $line];
    }
}
