<?php

namespace Tests\Feature;

use App\Models\ArticleAction;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PlanningHuman;
use App\Models\Quote;
use App\Models\Sample;
use App\Models\Site;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MissionTaskTerrainBoardTest extends TestCase
{
    use RefreshDatabase;

    public function test_updating_om_to_en_cours_creates_terrain_tasks(): void
    {
        [$om, $lab] = $this->seedTechnicienOm();

        MissionTask::query()->where('ordre_mission_ligne_id', $om->lignes()->first()->id)->forceDelete();

        $this->actingAs($lab, 'sanctum')
            ->putJson("/api/ordres-mission/{$om->id}", ['statut' => OrdreMission::STATUT_EN_COURS])
            ->assertOk()
            ->assertJsonPath('statut', OrdreMission::STATUT_EN_COURS);

        $this->assertSame(1, MissionTask::query()->count());
        $this->assertNotNull($om->fresh()->date_debut);

        $this->actingAs($lab, 'sanctum')
            ->getJson('/api/mission-tasks/terrain?active_only=1')
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_validating_an_om_line_syncs_task_planning_and_keeps_selected_quantity(): void
    {
        [$om, $lab] = $this->seedTechnicienOm();
        $ligne = $om->lignes()->firstOrFail();
        $technicien = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN]);
        $this->actingAs($lab, 'sanctum')
            ->putJson("/api/ordres-mission/{$om->id}/lignes/{$ligne->id}", [
                'quantite' => 4,
                'assigned_user_id' => $technicien->id,
                'date_prevue' => '2026-09-24',
                'statut' => 'en_cours',
            ])
            ->assertOk()
            ->assertJsonPath('assigned_user_id', $technicien->id)
            ->assertJsonPath('statut', 'en_cours');

        $task = MissionTask::query()->where('ordre_mission_ligne_id', $ligne->id)->firstOrFail();
        $this->assertSame(MissionTask::STATUT_IN_PROGRESS, $task->statut);
        $this->assertSame(OrdreMission::STATUT_EN_COURS, $om->fresh()->statut);
        $this->assertDatabaseHas('planning_humans', [
            'mission_task_id' => $task->id,
            'user_id' => $technicien->id,
            'date_debut' => '2026-09-24 00:00:00',
            'date_fin' => '2026-09-24 00:00:00',
        ]);

        $this->actingAs($lab, 'sanctum')
            ->getJson("/api/ordres-mission/{$om->id}")
            ->assertOk()
            ->assertJsonPath('lignes.0.quantite', 4);

        $this->assertSame(4.0, (float) $ligne->fresh()->quantite);
        $this->assertSame(1, PlanningHuman::query()->where('mission_task_id', $task->id)->count());

        $secondTechnicien = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN]);
        $this->actingAs($lab, 'sanctum')
            ->putJson("/api/mission-tasks/{$task->id}", [
                'assigned_user_id' => $secondTechnicien->id,
                'planned_date' => '2026-09-26',
                'statut' => MissionTask::STATUT_FROZEN,
            ])
            ->assertOk()
            ->assertJsonPath('statut', MissionTask::STATUT_FROZEN);

        $this->assertDatabaseHas('ordre_mission_lignes', [
            'id' => $ligne->id,
            'assigned_user_id' => $secondTechnicien->id,
            'statut' => 'freeze',
        ]);
        $this->assertDatabaseHas('planning_humans', [
            'mission_task_id' => $task->id,
            'user_id' => $secondTechnicien->id,
            'date_debut' => '2026-09-26 00:00:00',
        ]);
        $this->assertSame(OrdreMission::STATUT_EN_COURS, $om->fresh()->statut);

        $this->actingAs($lab, 'sanctum')
            ->putJson("/api/mission-tasks/{$task->id}", [
                'planned_date' => '2026-09-27',
                'statut' => MissionTask::STATUT_RESCHEDULED,
            ])
            ->assertOk()
            ->assertJsonPath('statut', MissionTask::STATUT_RESCHEDULED);
        $this->assertSame('replanifie', $ligne->fresh()->statut);
        $this->assertSame(OrdreMission::STATUT_PLANIFIE, $om->fresh()->statut);
        $this->actingAs($lab, 'sanctum')
            ->getJson("/api/v1/bons-commande/{$om->bon_commande_id}")
            ->assertJsonPath('avancement_om.statut', 'replanifie');

        $this->actingAs($lab, 'sanctum')
            ->putJson("/api/mission-tasks/{$task->id}", ['statut' => MissionTask::STATUT_REJECTED])
            ->assertOk();

        $this->assertSame('annule', $ligne->fresh()->statut);
        $this->assertSame(OrdreMission::STATUT_ANNULE, $om->fresh()->statut);
    }

    public function test_terrain_board_active_only_excludes_brouillon_om(): void
    {
        [$om, $lab] = $this->seedTechnicienOm();

        $this->actingAs($lab, 'sanctum')
            ->getJson('/api/mission-tasks/terrain?active_only=1')
            ->assertOk()
            ->assertJsonCount(0);

        $this->actingAs($lab, 'sanctum')
            ->getJson('/api/mission-tasks/terrain')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.ordre_mission_ligne.article.unite', 'unité')
            ->assertJsonPath('0.jalon_context.label', 'Jalon synchronisé');
    }

    public function test_closing_task_generates_reception_labels_once_and_consumes_bc_quantity(): void
    {
        [$om, $lab] = $this->seedTechnicienOm();
        $ligne = $om->lignes()->firstOrFail();
        $task = $ligne->ensureTaskExists();

        $payload = [
            'pv_numbers' => ['PV-2026-0042'],
            'quantity_unit' => 'unité',
            'quantity_count' => 1,
        ];

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/mission-tasks/{$task->id}/close-reception", $payload)
            ->assertOk()
            ->assertJsonPath('samples_created', 1)
            ->assertJsonPath('remaining_quantity', 0)
            ->assertJsonPath('task.statut', MissionTask::STATUT_DONE);

        $this->assertDatabaseHas('samples', [
            'task_id' => $task->id,
            'mission_order_id' => $om->id,
            'bon_commande_ligne_id' => $ligne->bon_commande_ligne_id,
            'status' => Sample::STATUS_EN_TRANSIT,
            'received_at' => null,
        ]);
        $this->assertNotNull(Sample::query()->where('task_id', $task->id)->value('prepared_by_task_at'));
        $this->assertSame(['PV-2026-0042'], $task->fresh()->pv_numbers);
        $this->assertSame('unité', $task->fresh()->quantity_unit);
        $this->assertSame('attente_validation', $ligne->fresh()->statut);
        $this->assertSame(OrdreMission::STATUT_EN_COURS, $om->fresh()->statut);

        $attendus = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/lab/reception/attendus')
            ->assertOk();
        $row = collect($attendus->json('data'))->firstWhere('id', $ligne->bon_commande_ligne_id);
        $this->assertSame(1, $row['quantite_en_transit']);
        $this->assertFalse($row['reception_complete']);
        $this->assertSame($task->unique_number, $row['tasks'][0]['unique_number']);
        $this->assertSame(1, $row['tasks'][0]['quantity_count']);
        $this->assertSame(1, $row['tasks'][0]['pending_labels']);

        $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/samples?status=en_transit')
            ->assertOk()
            ->assertJsonPath('data.0.task.unique_number', $task->unique_number);

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/mission-tasks/{$task->id}/close-reception", $payload)
            ->assertOk()
            ->assertJsonPath('samples_created', 0);

        $this->assertSame(1, Sample::query()->where('task_id', $task->id)->count());

        $sample = Sample::query()->where('task_id', $task->id)->firstOrFail();
        $this->actingAs($lab, 'sanctum')
            ->patchJson("/api/v1/samples/{$sample->id}/receive", ['condition_state' => 'bon'])
            ->assertOk();
        $this->assertSame(MissionTask::STATUT_VALIDATED, $task->fresh()->statut);
        $this->assertSame('cloture', $ligne->fresh()->statut);
        $this->assertSame(OrdreMission::STATUT_TERMINE, $om->fresh()->statut);
    }

    public function test_a_follow_up_task_can_be_added_for_the_remaining_bc_quantity(): void
    {
        [$om, $lab] = $this->seedTechnicienOm();
        $ligne = $om->lignes()->firstOrFail();
        $ligne->bonCommandeLigne()->update(['quantite' => 3]);
        $task = $ligne->ensureTaskExists();

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/mission-tasks/{$task->id}/close-reception", [
                'pv_numbers' => ['PV-RELIQUAT-1'],
                'quantity_unit' => 'point',
                'quantity_count' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('remaining_quantity', 2);

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/mission-tasks/{$task->id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('statut', MissionTask::STATUT_TODO);

        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ordre_mission_id' => $om->id,
            'bon_commande_ligne_id' => $ligne->bon_commande_ligne_id,
            'quantite' => 2,
            'statut' => 'planifie',
        ]);
    }

    /**
     * @return array{0: OrdreMission, 1: User}
     */
    private function seedTechnicienOm(): array
    {
        $client = Client::query()->create(['name' => 'Terrain sync client']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier sync']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-TASK-SYNC',
            'titre' => 'Dossier sync tâches',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $testType = TestType::query()->create(['name' => 'Essai sync', 'unit_price' => 100]);
        $legacyOrder = Order::query()->create([
            'reference' => 'ORD-TASK-SYNC',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'user_id' => $lab->id,
            'status' => 'confirmed',
            'order_date' => '2026-03-01',
        ]);
        OrderItem::query()->create(['order_id' => $legacyOrder->id, 'test_type_id' => $testType->id, 'quantity' => 1]);
        $famille = FamilleArticle::query()->create([
            'code' => 'GEO_SYNC',
            'libelle' => 'Sync',
            'ordre' => 1,
            'actif' => true,
        ]);
        $article = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ART-SYNC-1',
            'libelle' => 'Essai sync',
            'kind' => Article::KIND_JALON,
            'actif' => true,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'unite' => 'unité',
        ]);
        ArticleAction::query()->create([
            'ref_article_id' => $article->id,
            'type' => ArticleAction::TYPE_TECHNICIEN,
            'libelle' => 'Prélèvement sync',
            'duree_heures' => 2,
            'ordre' => 1,
        ]);
        $quote = Quote::query()->create([
            'number' => 'DEV-TASK-SYNC',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'quote_date' => '2026-03-01',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_VALIDATED,
            'meta' => [
                'devis_jalons' => [[
                    'id' => 'jalon-sync',
                    'libelle' => 'Jalon synchronisé',
                    's2g_code' => 'J-SYNC',
                    'product_ref_article_ids' => [$article->id],
                ]],
            ],
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-SYNC-001',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'quote_id' => $quote->id,
            'statut' => BonCommande::STATUT_EN_COURS,
            'date_commande' => '2026-03-01',
            'montant_ht' => 100,
            'montant_ttc' => 120,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        $bcLigne = BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $article->id,
            'libelle' => $article->libelle,
            'quantite' => 1,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'montant_ht' => 100,
        ]);
        $om = OrdreMission::query()->create([
            'numero' => OrdreMission::nextNumero(OrdreMission::TYPE_TECHNICIEN),
            'bon_commande_id' => $bc->id,
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'site_id' => $site->id,
            'type' => OrdreMission::TYPE_TECHNICIEN,
            'statut' => OrdreMission::STATUT_BROUILLON,
            'created_by' => $lab->id,
        ]);
        OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $om->id,
            'bon_commande_ligne_id' => $bcLigne->id,
            'ref_article_id' => $article->id,
            'libelle' => $article->libelle,
            'quantite' => 1,
            'statut' => 'a_faire',
            'ordre' => 0,
        ]);

        return [$om->fresh('lignes'), $lab];
    }
}
