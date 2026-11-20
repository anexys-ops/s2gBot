<?php

namespace Tests\Feature;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\MissionTask;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\Quote;
use App\Models\TestType;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MissionTaskSampleAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private ?int $orderItemId = null;

    /** Placeholder OrderItem : sqlite conserve order_item_id NOT NULL (legacy), contrairement à mysql/pgsql en prod. */
    private function orderItemId(): int
    {
        if ($this->orderItemId === null) {
            $client = Client::query()->create(['name' => 'Client OrderItem placeholder']);
            $order = Order::query()->create([
                'reference' => 'ORD-FOLD-TEST', 'client_id' => $client->id, 'status' => 'draft', 'order_date' => '2026-09-01',
            ]);
            $testType = TestType::query()->create(['name' => 'TestType placeholder']);
            $this->orderItemId = OrderItem::query()->create([
                'order_id' => $order->id, 'test_type_id' => $testType->id, 'quantity' => 1,
            ])->id;
        }

        return $this->orderItemId;
    }

    /** @return array{0: MissionTask, 1: MissionTask, 2: User, 3: BonCommande} */
    private function seedJalonWithTerrainAndLaboTasks(): array
    {
        $client = Client::query()->create(['name' => 'Client FOLD']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier FOLD']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-FOLD-001',
            'titre' => 'Dossier FOLD',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-09-01',
            'created_by' => $lab->id,
        ]);
        $famille = FamilleArticle::query()->create(['code' => 'FOLD_TEST', 'libelle' => 'Test', 'ordre' => 1, 'actif' => true]);
        $articleTerrain = Article::query()->create([
            'ref_famille_article_id' => $famille->id, 'code' => 'ART-TERRAIN', 'libelle' => 'Déplacement technicien',
            'kind' => Article::KIND_PRODUCT, 'actif' => true, 'prix_unitaire_ht' => 50, 'tva_rate' => 20,
        ]);
        $articleLabo = Article::query()->create([
            'ref_famille_article_id' => $famille->id, 'code' => 'ART-LABO', 'libelle' => 'Essai compression',
            'kind' => Article::KIND_PRODUCT, 'actif' => true, 'prix_unitaire_ht' => 80, 'tva_rate' => 20,
        ]);

        $quote = Quote::query()->create([
            'number' => 'DEV-FOLD-001', 'client_id' => $client->id, 'dossier_id' => $dossier->id,
            'quote_date' => '2026-09-01', 'amount_ht' => 1000, 'amount_ttc' => 1200, 'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
            'meta' => [
                'devis_jalons' => [[
                    'id' => 'beton', 'libelle' => 'Contrôle de béton', 'mode' => 'detaille',
                    'product_ref_article_ids' => [$articleTerrain->id, $articleLabo->id],
                ]],
            ],
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-FOLD-001', 'quote_id' => $quote->id, 'dossier_id' => $dossier->id,
            'client_id' => $client->id, 'statut' => BonCommande::STATUT_EN_COURS,
            'date_commande' => '2026-09-01', 'montant_ht' => 1000, 'montant_ttc' => 1200, 'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        $ligneTerrain = BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id, 'ref_article_id' => $articleTerrain->id, 'libelle' => $articleTerrain->libelle,
            'quantite' => 8, 'prix_unitaire_ht' => 50, 'tva_rate' => 20, 'montant_ht' => 400, 'ordre' => 0,
        ]);
        $ligneLabo = BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id, 'ref_article_id' => $articleLabo->id, 'libelle' => $articleLabo->libelle,
            'quantite' => 8, 'prix_unitaire_ht' => 80, 'tva_rate' => 20, 'montant_ht' => 640, 'ordre' => 1,
        ]);

        $omTerrain = OrdreMission::query()->create([
            'numero' => 'OM-T-FOLD-001', 'bon_commande_id' => $bc->id, 'dossier_id' => $dossier->id,
            'client_id' => $client->id, 'type' => OrdreMission::TYPE_TECHNICIEN, 'statut' => OrdreMission::STATUT_TERMINE,
            'created_by' => $lab->id,
        ]);
        $ligneOmTerrain = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $omTerrain->id, 'bon_commande_ligne_id' => $ligneTerrain->id,
            'ref_article_id' => $articleTerrain->id, 'libelle' => $articleTerrain->libelle,
            'quantite' => 8, 'statut' => 'cloture', 'ordre' => 0,
        ]);
        $terrainTask = $ligneOmTerrain->ensureTaskExists();
        $terrainTask->update(['statut' => MissionTask::STATUT_VALIDATED]);

        $omLabo = OrdreMission::query()->create([
            'numero' => 'OM-L-FOLD-001', 'bon_commande_id' => $bc->id, 'dossier_id' => $dossier->id,
            'client_id' => $client->id, 'type' => OrdreMission::TYPE_LABO, 'statut' => OrdreMission::STATUT_BROUILLON,
            'created_by' => $lab->id,
        ]);
        $ligneOmLabo = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $omLabo->id, 'bon_commande_ligne_id' => $ligneLabo->id,
            'ref_article_id' => $articleLabo->id, 'libelle' => $articleLabo->libelle,
            'quantite' => 8, 'statut' => 'a_faire', 'ordre' => 0,
        ]);
        $laboTask = $ligneOmLabo->ensureTaskExists();

        return [$terrainTask, $laboTask, $lab, $bc];
    }

    public function test_closing_terrain_mission_links_its_fold_to_the_labo_task_then_transco_after_reception(): void
    {
        [$terrainTask, $laboTask, $lab, $bc] = $this->seedJalonWithTerrainAndLaboTasks();
        $this->orderItemId();
        // Deuxième tâche labo du même produit : le FOLD ne doit aller qu'à une seule (la première libre).
        $secondLabo = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $laboTask->ordreMissionLigne->ordre_mission_id,
            'bon_commande_ligne_id' => $laboTask->ordreMissionLigne->bon_commande_ligne_id,
            'ref_article_id' => $laboTask->ordreMissionLigne->ref_article_id,
            'libelle' => 'Essai compression', 'quantite' => 1, 'statut' => 'a_faire', 'ordre' => 1,
        ])->ensureTaskExists();

        $this->actingAs($lab, 'sanctum')->postJson("/api/mission-tasks/{$terrainTask->id}/close-reception", [
            'pv_numbers' => ['0152820'],
            'quantity_unit' => 'U',
            'quantity_count' => 1,
        ])->assertOk()->assertJsonPath('samples_created', 1);

        $sample = Sample::query()->where('task_id', $terrainTask->id)->firstOrFail();
        $this->assertSame([$sample->id], $laboTask->fresh()->samples()->pluck('samples.id')->all());
        $this->assertSame(0, $secondLabo->fresh()->samples()->count());

        $this->actingAs($lab, 'sanctum')->patchJson("/api/v1/samples/{$sample->id}/receive", [
            'condition_state' => 'bon',
        ])->assertOk();
        $transco = $sample->fresh()->transco_number;
        $this->assertNotEmpty($transco);
        $this->assertNotNull($laboTask->fresh()->planned_date);

        $board = collect($this->actingAs($lab, 'sanctum')->getJson('/api/mission-tasks/labo')->assertOk()->json());
        $row = $board->firstWhere('id', $laboTask->id);
        $this->assertSame($transco, $row['samples'][0]['transco_number']);
        $this->assertSame(['0152820'], $row['samples'][0]['task']['pv_numbers']);
    }

    public function test_reception_from_bc_line_finds_terrain_mission_pv_and_links_labo_task(): void
    {
        [$terrainTask, $laboTask, $lab, $bc] = $this->seedJalonWithTerrainAndLaboTasks();
        $this->orderItemId();
        $terrainTask->update(['pv_numbers' => ['1233ID']]);
        $ligneTerrain = $terrainTask->ordreMissionLigne->bonCommandeLigne;
        $ligneTerrain->update(['technicien_id' => $lab->id]);
        \App\Models\TaskTestForm::query()->create([
            'mission_task_id' => $terrainTask->id,
            'test_type_id' => TestType::query()->create(['name' => 'Prélèvement'])->id,
            'status' => 'validated',
            'form_snapshot' => [],
            'answers' => ['nombre_d_echantillons' => '2'],
        ]);
        $attendu = collect($this->actingAs($lab, 'sanctum')->getJson('/api/v1/lab/reception/attendus')->assertOk()->json('data'))
            ->firstWhere('id', $ligneTerrain->id);
        $this->assertSame(2, $attendu['nombre_echantillons_formulaire']);

        $sampleId = (int) $this->actingAs($lab, 'sanctum')->postJson('/api/v1/lab/reception/receive-from-line', [
            'bon_commande_ligne_id' => $ligneTerrain->id,
            'condition_state' => 'bon',
        ])->assertCreated()->json('id');

        $sample = Sample::query()->findOrFail($sampleId);
        $this->assertSame($terrainTask->id, $sample->task_id);
        $this->assertNotEmpty($sample->transco_number);
        $this->assertSame([$sampleId], $laboTask->fresh()->samples()->pluck('samples.id')->all());

        $jalons = $this->actingAs($lab, 'sanctum')->getJson('/api/v1/lab/reception/jalons-recus')->assertOk();
        $this->assertSame(['1233ID'], $jalons->json('data.0.pv_numbers'));

        // Vue Ordres de mission : même suivi de réception sur l'OdM labo.
        $om = collect($this->actingAs($lab, 'sanctum')->getJson('/api/ordres-mission?type=labo')->assertOk()->json())
            ->firstWhere('id', $laboTask->ordreMissionLigne->ordre_mission_id);
        $this->assertSame(1, $om['reception']['taches_receptionnees']);
        $this->assertSame(['1233ID'], $om['reception']['pv_numbers']);
        $this->assertSame([$sample->transco_number], $om['reception']['numeros_reception']);
    }

    public function test_labo_task_lists_only_same_jalon_samples_by_default(): void
    {
        [$terrainTask, $laboTask, $lab, $bc] = $this->seedJalonWithTerrainAndLaboTasks();

        $sampleSameJalon = Sample::query()->create([
            'order_item_id' => $this->orderItemId(),
            'reference' => 'REF-'.uniqid(),
            'task_id' => $terrainTask->id,
            'bon_commande_ligne_id' => $terrainTask->ordreMissionLigne->bon_commande_ligne_id,
            'sample_type' => 'beton', 'status' => Sample::STATUS_RECEPTIONNE, 'received_at' => '2026-09-25',
        ]);

        // Un FOLD d'un AUTRE jalon (ligne/article sans rapport) ne doit pas apparaître.
        $otherLigne = BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id, 'ref_article_id' => null, 'libelle' => 'Autre jalon',
            'quantite' => 1, 'prix_unitaire_ht' => 10, 'tva_rate' => 20, 'montant_ht' => 10, 'ordre' => 2,
        ]);
        $otherOm = OrdreMission::query()->create([
            'numero' => 'OM-T-FOLD-002', 'bon_commande_id' => $bc->id, 'client_id' => $bc->client_id, 'type' => OrdreMission::TYPE_TECHNICIEN,
            'statut' => OrdreMission::STATUT_TERMINE, 'created_by' => $lab->id,
        ]);
        $otherOmLigne = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $otherOm->id, 'bon_commande_ligne_id' => $otherLigne->id,
            'libelle' => 'Autre jalon', 'quantite' => 1, 'statut' => 'cloture', 'ordre' => 0,
        ]);
        $otherTask = $otherOmLigne->ensureTaskExists();
        $otherSample = Sample::query()->create([
            'order_item_id' => $this->orderItemId(), 'reference' => 'REF-'.uniqid(),
            'task_id' => $otherTask->id, 'bon_commande_ligne_id' => $otherLigne->id,
            'sample_type' => 'sol', 'status' => Sample::STATUS_RECEPTIONNE, 'received_at' => '2026-09-25',
        ]);

        $resp = $this->actingAs($lab, 'sanctum')
            ->getJson("/api/mission-tasks/{$laboTask->id}/available-samples")
            ->assertOk();
        $ids = collect($resp->json())->pluck('id');
        $this->assertTrue($ids->contains($sampleSameJalon->id));
        $this->assertFalse($ids->contains($otherSample->id));

        // Avec force=1, le FOLD de l'autre jalon doit apparaître aussi.
        $respForced = $this->actingAs($lab, 'sanctum')
            ->getJson("/api/mission-tasks/{$laboTask->id}/available-samples?force=1")
            ->assertOk();
        $this->assertTrue(collect($respForced->json())->pluck('id')->contains($otherSample->id));
    }

    public function test_attaching_sample_from_other_jalon_is_rejected_without_force(): void
    {
        [$terrainTask, $laboTask, $lab, $bc] = $this->seedJalonWithTerrainAndLaboTasks();

        $otherLigne = BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id, 'libelle' => 'Autre jalon',
            'quantite' => 1, 'prix_unitaire_ht' => 10, 'tva_rate' => 20, 'montant_ht' => 10, 'ordre' => 2,
        ]);
        $otherOm = OrdreMission::query()->create([
            'numero' => 'OM-T-FOLD-003', 'bon_commande_id' => $bc->id, 'client_id' => $bc->client_id, 'type' => OrdreMission::TYPE_TECHNICIEN,
            'statut' => OrdreMission::STATUT_TERMINE, 'created_by' => $lab->id,
        ]);
        $otherOmLigne = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $otherOm->id, 'bon_commande_ligne_id' => $otherLigne->id,
            'libelle' => 'Autre jalon', 'quantite' => 1, 'statut' => 'cloture', 'ordre' => 0,
        ]);
        $otherTask = $otherOmLigne->ensureTaskExists();
        $otherSample = Sample::query()->create([
            'order_item_id' => $this->orderItemId(), 'reference' => 'REF-'.uniqid(),
            'task_id' => $otherTask->id, 'bon_commande_ligne_id' => $otherLigne->id,
            'sample_type' => 'sol', 'status' => Sample::STATUS_RECEPTIONNE, 'received_at' => '2026-09-25',
        ]);

        $this->actingAs($lab, 'sanctum')->postJson(
            "/api/mission-tasks/{$laboTask->id}/samples",
            ['sample_ids' => [$otherSample->id]],
        )->assertStatus(422);
        $this->assertSame(0, $laboTask->samples()->count());

        $this->actingAs($lab, 'sanctum')->postJson(
            "/api/mission-tasks/{$laboTask->id}/samples",
            ['sample_ids' => [$otherSample->id], 'forced' => true],
        )->assertOk();
        $this->assertSame(1, $laboTask->samples()->count());
    }

    public function test_attaching_sample_auto_plans_next_business_day_after_reception_and_stays_editable(): void
    {
        [$terrainTask, $laboTask, $lab] = $this->seedJalonWithTerrainAndLaboTasks();

        $sample = Sample::query()->create([
            'order_item_id' => $this->orderItemId(),
            'reference' => 'REF-'.uniqid(),
            'task_id' => $terrainTask->id,
            'bon_commande_ligne_id' => $terrainTask->ordreMissionLigne->bon_commande_ligne_id,
            'sample_type' => 'beton', 'status' => Sample::STATUS_RECEPTIONNE, 'received_at' => '2026-09-25', // vendredi
        ]);

        $this->assertNull($laboTask->fresh()->planned_date);

        $resp = $this->actingAs($lab, 'sanctum')->postJson(
            "/api/mission-tasks/{$laboTask->id}/samples",
            ['sample_ids' => [$sample->id]],
        )->assertOk();

        // Vendredi + 1 jour ouvré = lundi (saute le week-end).
        $this->assertSame('2026-09-28', $laboTask->fresh()->planned_date->format('Y-m-d'));
        $this->assertSame(1, $laboTask->fresh()->samples()->count());

        // Une replanification manuelle explicite doit rester possible et ne pas être écrasée.
        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/mission-tasks/{$laboTask->id}",
            ['planned_date' => '2026-10-05'],
        )->assertOk();

        $sample2 = Sample::query()->create([
            'order_item_id' => $this->orderItemId(),
            'reference' => 'REF-'.uniqid(),
            'task_id' => $terrainTask->id,
            'bon_commande_ligne_id' => $terrainTask->ordreMissionLigne->bon_commande_ligne_id,
            'sample_type' => 'beton', 'status' => Sample::STATUS_RECEPTIONNE, 'received_at' => '2026-09-20',
        ]);
        $this->actingAs($lab, 'sanctum')->postJson(
            "/api/mission-tasks/{$laboTask->id}/samples",
            ['sample_ids' => [$sample2->id]],
        )->assertOk();
        $this->assertSame('2026-10-05', $laboTask->fresh()->planned_date->format('Y-m-d'));
    }

    public function test_detach_sample_removes_it_from_labo_task(): void
    {
        [$terrainTask, $laboTask, $lab] = $this->seedJalonWithTerrainAndLaboTasks();
        $sample = Sample::query()->create([
            'order_item_id' => $this->orderItemId(),
            'reference' => 'REF-'.uniqid(),
            'task_id' => $terrainTask->id,
            'bon_commande_ligne_id' => $terrainTask->ordreMissionLigne->bon_commande_ligne_id,
            'sample_type' => 'beton', 'status' => Sample::STATUS_RECEPTIONNE, 'received_at' => '2026-09-25',
        ]);
        $this->actingAs($lab, 'sanctum')->postJson(
            "/api/mission-tasks/{$laboTask->id}/samples",
            ['sample_ids' => [$sample->id]],
        )->assertOk();
        $this->assertSame(1, $laboTask->samples()->count());

        $this->actingAs($lab, 'sanctum')
            ->deleteJson("/api/mission-tasks/{$laboTask->id}/samples/{$sample->id}")
            ->assertOk();
        $this->assertSame(0, $laboTask->fresh()->samples()->count());
    }

    public function test_labo_task_cannot_advance_statut_without_fold_unless_flagged(): void
    {
        [, $laboTask, $lab] = $this->seedJalonWithTerrainAndLaboTasks();

        // Sans FOLD ni flag : le passage à "en_cours" est refusé.
        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/mission-tasks/{$laboTask->id}",
            ['statut' => 'in_progress'],
        )->assertStatus(422);
        $this->assertSame(MissionTask::STATUT_TODO, $laboTask->fresh()->statut);

        // Avec le flag "pas de FOLD nécessaire" : autorisé.
        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/mission-tasks/{$laboTask->id}",
            ['statut' => 'in_progress', 'no_fold_required' => true],
        )->assertOk();
        $this->assertSame(MissionTask::STATUT_IN_PROGRESS, $laboTask->fresh()->statut);
    }

    public function test_no_fold_required_flag_can_be_set_via_update(): void
    {
        [, $laboTask, $lab] = $this->seedJalonWithTerrainAndLaboTasks();

        $this->assertFalse($laboTask->fresh()->no_fold_required);

        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/mission-tasks/{$laboTask->id}",
            ['no_fold_required' => true],
        )->assertOk();

        $this->assertTrue($laboTask->fresh()->no_fold_required);
    }
}
