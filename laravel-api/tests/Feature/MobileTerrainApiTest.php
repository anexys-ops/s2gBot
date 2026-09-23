<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\BcLignePlanningAffectation;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\ArticleAction;
use App\Models\TestType;
use App\Models\Dossier;
use App\Models\Equipment;
use App\Models\ExpenseReport;
use App\Models\MaterielAffectation;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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

    public function test_mobile_task_status_transitions_sync_mission_and_return_detail(): void
    {
        [$user, $other, $om] = $this->seedMission();
        $task = $this->taskFor($om, $user, 'Tâche mobile');
        $otherTask = $this->taskFor($om, $other, 'Tâche autre');
        $url = '/api/mobile/terrain/tasks/'.$task->id.'/status';

        $this->actingAs($other, 'sanctum')->patchJson($url, ['statut' => 'in_progress'])->assertForbidden();
        $this->actingAs($user, 'sanctum')->patchJson($url, ['statut' => 'done'])
            ->assertUnprocessable()->assertJsonValidationErrors('statut');
        $this->patchJson($url, ['statut' => 'in_progress'])
            ->assertOk()->assertJsonPath('statut', 'in_progress')
            ->assertJsonPath('client.name', 'Client mobile');
        $this->assertNotNull($task->fresh()->started_at);
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'id' => $task->ordre_mission_ligne_id, 'statut' => 'en_cours',
        ]);
        $this->assertDatabaseHas('ordres_mission', ['id' => $om->id, 'statut' => OrdreMission::STATUT_EN_COURS]);
        $this->patchJson($url, ['statut' => 'paused'])->assertOk()->assertJsonPath('statut', 'paused');
        $this->patchJson($url, ['statut' => 'in_progress'])->assertOk();
        $this->patchJson($url, ['statut' => 'done'])
            ->assertOk()->assertJsonPath('statut', 'done')->assertJsonPath('ordre_mission.id', $om->id);
        $this->assertNotNull($task->fresh()->completed_at);
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'id' => $task->ordre_mission_ligne_id, 'statut' => 'attente_validation',
        ]);
        $this->patchJson($url, ['statut' => 'done'])->assertUnprocessable()->assertJsonValidationErrors('statut');
        $this->patchJson($url, ['statut' => 'rejected', 'motif' => 'Abandon'])
            ->assertUnprocessable()->assertJsonValidationErrors('statut');

        $cancelUrl = '/api/mobile/terrain/tasks/'.$otherTask->id.'/status';
        $this->actingAs($other, 'sanctum')->patchJson($cancelUrl, ['statut' => 'rejected'])
            ->assertUnprocessable()->assertJsonValidationErrors('motif');
        $this->patchJson($cancelUrl, ['statut' => 'rejected', 'motif' => '   '])
            ->assertUnprocessable()->assertJsonValidationErrors('motif');
        $this->patchJson($cancelUrl, ['statut' => 'rejected', 'motif' => 'Chantier annulé'])
            ->assertOk()->assertJsonPath('statut', 'rejected')
            ->assertJsonPath('cancellation_reason', 'Chantier annulé');
        $this->getJson('/api/mobile/terrain/tasks/'.$otherTask->id)
            ->assertOk()->assertJsonPath('cancellation_reason', 'Chantier annulé');
        $this->patchJson($cancelUrl, ['statut' => 'in_progress'])
            ->assertUnprocessable()->assertJsonValidationErrors('statut');
    }

    public function test_mobile_task_notes_remain_editable_after_completion_and_cancellation(): void
    {
        [$user, $other, $om] = $this->seedMission();
        $task = $this->taskFor($om, $user, 'Compte rendu terrain');
        $url = '/api/mobile/terrain/tasks/'.$task->id.'/notes';

        $this->actingAs($other, 'sanctum')->patchJson($url, ['notes' => 'Intrusion'])->assertForbidden();
        $this->actingAs($user, 'sanctum')->patchJson($url, ['notes' => 'Mesures effectuées'])
            ->assertOk()->assertJsonPath('notes', 'Mesures effectuées')
            ->assertJsonPath('client.name', 'Client mobile');
        $task->update(['statut' => 'done']);
        $this->patchJson($url, ['notes' => 'Mesures corrigées'])
            ->assertOk()->assertJsonPath('notes', 'Mesures corrigées');
        $task->update(['statut' => 'rejected']);
        $this->patchJson($url, ['notes' => null])->assertOk()->assertJsonPath('notes', null);
        $task->update(['statut' => 'validated']);
        $this->patchJson($url, ['notes' => 'Note finale'])->assertOk()->assertJsonPath('notes', 'Note finale');
        $this->patchJson($url, [])->assertUnprocessable()->assertJsonValidationErrors('notes');
    }

    public function test_mobile_pv_numbers_are_free_text_unique_and_frozen_after_reception(): void
    {
        [$user, $other, $om] = $this->seedMission();
        $task = $this->taskFor($om, $user, 'Prélèvement terrain');
        $url = '/api/mobile/terrain/tasks/'.$task->id.'/pv-numbers';

        $this->actingAs($other, 'sanctum')->getJson($url)->assertForbidden();
        $this->actingAs($user, 'sanctum')->getJson($url)
            ->assertOk()->assertJsonPath('pv_numbers', [])->assertJsonPath('count', 0)
            ->assertJsonPath('editable', true);
        $this->postJson($url, ['pv_number' => ' PV-001 '])
            ->assertOk()->assertJsonPath('pv_numbers', ['PV-001'])->assertJsonPath('count', 1);
        $this->postJson($url, ['pv_number' => 'pv-001'])->assertOk()->assertJsonPath('count', 1);
        $this->postJson($url, ['pv_number' => 'PV-002'])->assertOk()->assertJsonPath('count', 2);
        $this->postJson($url, ['pv_number' => 'PV-003,PV-004'])
            ->assertUnprocessable()->assertJsonValidationErrors('pv_number');
        $this->deleteJson($url, ['pv_number' => 'pv-001'])
            ->assertOk()->assertJsonPath('pv_numbers', ['PV-002'])->assertJsonPath('count', 1);
        $this->getJson('/api/mobile/terrain/tasks/'.$task->id)
            ->assertOk()->assertJsonPath('pv_numbers', ['PV-002']);
        $this->assertDatabaseMissing('samples', ['task_id' => $task->id]);
        $task->update(['reception_generated_at' => now()]);
        $this->getJson($url)->assertOk()->assertJsonPath('editable', false);
        $this->postJson($url, ['pv_number' => 'PV-003'])
            ->assertUnprocessable()->assertJsonValidationErrors('pv_number');
        $this->deleteJson($url, ['pv_number' => 'PV-002'])
            ->assertUnprocessable()->assertJsonValidationErrors('pv_number');
        $this->actingAs($other, 'sanctum')->postJson($url, ['pv_number' => 'PV-003'])->assertForbidden();
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

    public function test_mobile_standalone_expense_and_line_photo_are_private(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($user, 'sanctum');

        $this->postJson('/api/mobile/terrain/expense-reports/standalone', ['ordre_mission_id' => 1])
            ->assertUnprocessable();
        $reportId = $this->postJson('/api/mobile/terrain/expense-reports/standalone', [
            'notes' => 'Déplacement hors mission',
        ])->assertCreated()->assertJsonPath('ordre_mission_id', null)
            ->assertJsonPath('user_id', $user->id)->json('id');
        $lineId = $this->postJson("/api/mobile/terrain/expense-reports/{$reportId}/lines", [
            'category' => 'Parking', 'date' => '2026-09-23', 'amount' => 20,
        ])->assertCreated()->json('id');
        $photoUrl = "/api/mobile/terrain/expense-reports/{$reportId}/lines/{$lineId}/photo";
        $this->post($photoUrl, ['photo' => UploadedFile::fake()->image('ticket.jpg')], [
            'Accept' => 'application/json',
        ])->assertOk()->assertJsonPath('receipt_filename', 'ticket.jpg');
        $path = \App\Models\ExpenseLine::findOrFail($lineId)->receipt_path;
        Storage::disk('local')->assertExists($path);
        $this->get($photoUrl)->assertOk();

        $this->actingAs($other, 'sanctum')->get($photoUrl)->assertForbidden();
        $this->post($photoUrl, ['photo' => UploadedFile::fake()->image('autre.jpg')], [
            'Accept' => 'application/json',
        ])->assertForbidden();

        $this->actingAs($user, 'sanctum')->postJson("/api/mobile/terrain/expense-reports/{$reportId}/submit")
            ->assertOk();
        $this->post($photoUrl, ['photo' => UploadedFile::fake()->image('nouveau.jpg')], [
            'Accept' => 'application/json',
        ])->assertUnprocessable();
        Storage::disk('local')->assertExists($path);
    }

    public function test_product_form_can_be_corrected_and_closes_task_only_after_review(): void
    {
        Storage::fake('local');
        [$user, $other, $om] = $this->seedMission();
        $reviewer = User::factory()->create(['role' => User::ROLE_LAB_ADMIN]);
        $family = FamilleArticle::query()->create(['code' => 'FORM', 'libelle' => 'Formulaires', 'ordre' => 1, 'actif' => true]);
        $product = Article::query()->create([
            'ref_famille_article_id' => $family->id,
            'code' => 'PROD-FORM', 'libelle' => 'Produit contrôle', 'kind' => Article::KIND_PRODUCT,
            'prix_unitaire_ht' => 0, 'tva_rate' => 20, 'actif' => true,
        ]);
        $task = $this->taskFor($om, $user, 'Mesurer le produit');
        $task->ordreMissionLigne->update(['ref_article_id' => $product->id]);
        $type = TestType::query()->create([
            'name' => 'Essai de contrôle', 'unit_price' => 0,
            'form_fields' => [
                ['key' => 'valeur', 'label' => 'Valeur', 'type' => 'number', 'required' => true, 'unit' => 'MPa'],
                ['key' => 'photo', 'label' => 'Photo', 'type' => 'photo', 'required' => true],
            ],
        ]);
        $this->actingAs($reviewer, 'sanctum')->putJson('/api/test-types/'.$type->id.'/products', [
            'assignments' => [['article_id' => $product->id]],
        ])->assertOk();
        $url = '/api/mobile/task-forms/tasks/'.$task->id.'/types/'.$type->id;
        $this->actingAs($user, 'sanctum')->getJson('/api/mobile/task-forms/tasks/'.$task->id)
            ->assertOk()->assertJsonCount(1, 'forms')->assertJsonPath('forms.0.test_type.id', $type->id);
        $this->putJson('/api/mission-tasks/'.$task->id, ['statut' => 'validated'])->assertUnprocessable();
        $this->postJson('/api/mission-tasks/'.$task->id.'/validate', ['is_conform' => true])->assertUnprocessable();
        $this->putJson($url, ['answers' => ['valeur' => 12.5]])->assertOk()->assertJsonPath('status', 'draft');
        $this->postJson($url.'/submit')->assertUnprocessable();
        $photoId = $this->post($url.'/photos', [
            'field_key' => 'photo', 'photo' => UploadedFile::fake()->image('chantier.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('id');
        $this->get('/api/mobile/task-forms/photos/'.$photoId, ['Accept' => 'application/json'])->assertOk();
        $this->postJson($url.'/submit')->assertOk()->assertJsonPath('status', 'submitted');
        $this->assertDatabaseHas('mission_tasks', ['id' => $task->id, 'statut' => 'todo']);
        $this->actingAs($other, 'sanctum')->getJson('/api/mobile/task-forms/tasks/'.$task->id)->assertForbidden();
        $this->actingAs($reviewer, 'sanctum')->postJson($url.'/review', [
            'decision' => 'correction', 'correction_note' => 'Reprendre la valeur.',
        ])->assertOk()->assertJsonPath('status', 'correction_requested');
        $this->actingAs($user, 'sanctum')->putJson($url, ['answers' => ['valeur' => 13]])->assertOk();
        $this->postJson($url.'/submit')->assertOk();
        $this->actingAs($reviewer, 'sanctum')->postJson($url.'/review', ['decision' => 'validate'])
            ->assertOk()->assertJsonPath('status', 'validated');
        $this->assertDatabaseHas('mission_tasks', ['id' => $task->id, 'statut' => 'validated']);
        $this->getJson('/api/mission-tasks/'.$task->id)->assertOk()->assertJsonPath('test_forms.0.status', 'validated');
    }

    public function test_form_assigned_to_one_product_action_is_available_to_laboratory_task_only_for_that_action(): void
    {
        [$user, , $om] = $this->seedMission();
        $om->update(['type' => OrdreMission::TYPE_LABO]);
        $family = FamilleArticle::query()->create(['code' => 'LAB-FORM', 'libelle' => 'Formulaires labo', 'ordre' => 1, 'actif' => true]);
        $product = Article::query()->create([
            'ref_famille_article_id' => $family->id, 'code' => 'LAB-PROD', 'libelle' => 'Produit labo',
            'kind' => Article::KIND_PRODUCT, 'prix_unitaire_ht' => 0, 'tva_rate' => 20, 'actif' => true,
        ]);
        $actionA = ArticleAction::query()->create(['ref_article_id' => $product->id, 'type' => 'labo', 'libelle' => 'Essai A', 'ordre' => 1]);
        $actionB = ArticleAction::query()->create(['ref_article_id' => $product->id, 'type' => 'labo', 'libelle' => 'Essai B', 'ordre' => 2]);
        $type = TestType::query()->create([
            'name' => 'Fiche essai A', 'unit_price' => 0,
            'form_fields' => [['key' => 'note', 'label' => 'Note', 'type' => 'text', 'required' => true]],
        ]);
        $type->articles()->sync([$product->id => ['article_action_id' => $actionA->id]]);
        $task = $this->taskFor($om, $user, 'Essai labo');
        $task->ordreMissionLigne->update(['ref_article_id' => $product->id, 'article_action_id' => $actionB->id]);

        $this->actingAs($user, 'sanctum')->getJson('/api/mobile/task-forms/tasks/'.$task->id)->assertOk()->assertJsonCount(0, 'forms');
        $task->ordreMissionLigne->update(['article_action_id' => $actionA->id]);
        $this->getJson('/api/mobile/task-forms/tasks/'.$task->id)->assertOk()->assertJsonCount(1, 'forms');
        $this->getJson('/api/mobile/terrain/tasks')->assertOk()->assertJsonCount(1);
    }

    public function test_article_can_assign_its_own_essais_without_changing_another_product(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_LAB_ADMIN]);
        $family = FamilleArticle::query()->create(['code' => 'FORM-PROD', 'libelle' => 'Produits', 'ordre' => 1, 'actif' => true]);
        $first = Article::query()->create([
            'ref_famille_article_id' => $family->id, 'code' => 'FORM-1', 'libelle' => 'Produit 1',
            'kind' => Article::KIND_PRODUCT, 'prix_unitaire_ht' => 0, 'tva_rate' => 20, 'actif' => true,
        ]);
        $second = Article::query()->create([
            'ref_famille_article_id' => $family->id, 'code' => 'FORM-2', 'libelle' => 'Produit 2',
            'kind' => Article::KIND_PRODUCT, 'prix_unitaire_ht' => 0, 'tva_rate' => 20, 'actif' => true,
        ]);
        $action = ArticleAction::query()->create(['ref_article_id' => $first->id, 'type' => 'technicien', 'libelle' => 'Relevé', 'ordre' => 1]);
        $otherAction = ArticleAction::query()->create(['ref_article_id' => $second->id, 'type' => 'labo', 'libelle' => 'Autre', 'ordre' => 1]);
        $type = TestType::query()->create([
            'name' => 'Fiche de relevé', 'unit_price' => 0,
            'form_fields' => [['key' => 'mesure', 'label' => 'Mesure', 'type' => 'number', 'required' => true]],
        ]);
        $type->articles()->sync([$second->id => ['article_action_id' => null]]);
        $url = '/api/v1/catalogue/articles/'.$first->id.'/test-types';

        $this->actingAs($admin, 'sanctum')->putJson($url, [
            'assignments' => [['test_type_id' => $type->id, 'article_action_id' => $otherAction->id]],
        ])->assertUnprocessable();
        $this->putJson($url, [
            'assignments' => [['test_type_id' => $type->id, 'article_action_id' => $action->id]],
        ])->assertOk()->assertJsonPath('data.test_types.0.article_action_id', $action->id);
        $this->assertDatabaseHas('article_test_type', ['ref_article_id' => $second->id, 'test_type_id' => $type->id]);
        $this->putJson($url, ['assignments' => []])->assertOk()->assertJsonCount(0, 'data.test_types');
        $this->assertDatabaseHas('article_test_type', ['ref_article_id' => $second->id, 'test_type_id' => $type->id]);
    }

    public function test_dynamic_terrain_form_calculates_table_and_keeps_shared_list_snapshot(): void
    {
        [$user, , $om] = $this->seedMission();
        $admin = User::factory()->create(['role' => User::ROLE_LAB_ADMIN]);
        $family = FamilleArticle::query()->create(['code' => 'DYN', 'libelle' => 'Dynamique', 'ordre' => 1, 'actif' => true]);
        $product = Article::query()->create([
            'ref_famille_article_id' => $family->id, 'code' => 'DYN-1', 'libelle' => 'Produit dynamique',
            'kind' => Article::KIND_PRODUCT, 'prix_unitaire_ht' => 0, 'tva_rate' => 20, 'actif' => true,
        ]);
        $task = $this->taskFor($om, $user, 'Mesure terrain');
        $task->ordreMissionLigne->update(['ref_article_id' => $product->id]);
        $list = $this->actingAs($admin, 'sanctum')->postJson('/api/form-option-lists', [
            'name' => 'État du sol', 'options' => ['Sec', 'Humide'],
        ])->assertCreated()->json();
        $fields = [
            ['key' => 'longueur', 'label' => 'Longueur', 'type' => 'number', 'required' => true],
            ['key' => 'largeur', 'label' => 'Largeur', 'type' => 'number', 'required' => true],
            ['key' => 'surface', 'label' => 'Surface', 'type' => 'formula', 'formula' => 'longueur * largeur', 'required' => true],
            ['key' => 'etat', 'label' => 'État', 'type' => 'select', 'list_id' => $list['id'], 'required' => true],
            ['key' => 'observations', 'label' => 'Observations', 'type' => 'table', 'required' => true, 'columns' => [
                ['key' => 'nombre', 'label' => 'Nombre', 'type' => 'number', 'required' => true],
                ['key' => 'prix', 'label' => 'Prix', 'type' => 'number', 'required' => true],
                ['key' => 'total', 'label' => 'Total', 'type' => 'formula', 'formula' => 'nombre * prix', 'required' => true],
            ]],
            ['key' => 'defauts', 'label' => 'Défauts', 'type' => 'checkboxes', 'options' => ['Fissure', 'Humidité'], 'required' => false],
        ];
        $typeId = $this->postJson('/api/test-types', [
            'name' => 'Contrôle terrain dynamique', 'context' => 'terrain', 'unit_price' => 0, 'form_fields' => $fields,
        ])->assertCreated()->json('id');
        $this->postJson('/api/test-types', [
            'name' => 'Formule invalide', 'context' => 'terrain', 'unit_price' => 0,
            'form_fields' => [['key' => 'total', 'label' => 'Total', 'type' => 'formula', 'formula' => 'champ_inconnu * 2', 'required' => true]],
        ])->assertUnprocessable();
        $wrongAction = ArticleAction::query()->create(['ref_article_id' => $product->id, 'type' => 'labo', 'libelle' => 'Action labo', 'ordre' => 1]);
        $this->postJson('/api/test-types', [
            'name' => 'Création annulée', 'context' => 'terrain', 'unit_price' => 0,
            'form_fields' => [['key' => 'note', 'label' => 'Note', 'type' => 'text', 'required' => false]],
            'assignments' => [['article_id' => $product->id, 'article_action_id' => $wrongAction->id]],
        ])->assertUnprocessable();
        $this->assertDatabaseMissing('test_types', ['name' => 'Création annulée']);
        $labTypeId = $this->postJson('/api/test-types', [
            'name' => 'Essai réservé au laboratoire', 'context' => 'labo', 'unit_price' => 0,
            'form_fields' => [['key' => 'note', 'label' => 'Note', 'type' => 'text', 'required' => false]],
        ])->assertCreated()->json('id');
        $this->putJson('/api/v1/catalogue/articles/'.$product->id.'/test-types', [
            'assignments' => [['test_type_id' => $typeId], ['test_type_id' => $labTypeId]],
        ])->assertOk();
        $url = '/api/mobile/task-forms/tasks/'.$task->id.'/types/'.$typeId;
        $this->actingAs($user, 'sanctum')->getJson('/api/mobile/task-forms/tasks/'.$task->id)
            ->assertOk()->assertJsonCount(1, 'forms')->assertJsonPath('forms.0.form_fields.3.options.0', 'Sec');
        $this->putJson($url, ['answers' => [
            'longueur' => 4, 'largeur' => 3, 'surface' => 999, 'etat' => 'Humide',
            'observations' => [['nombre' => 2, 'prix' => 5, 'total' => 999]],
            'defauts' => ['Fissure'],
        ]])->assertOk()->assertJsonPath('answers.surface', 12)->assertJsonPath('answers.observations.0.total', 10);
        $this->actingAs($admin, 'sanctum')->putJson('/api/form-option-lists/'.$list['id'], [
            'options' => ['Sec', 'Mouillé'],
        ])->assertOk();
        $this->deleteJson('/api/form-option-lists/'.$list['id'])->assertUnprocessable();
        $this->actingAs($user, 'sanctum')->getJson('/api/mobile/task-forms/tasks/'.$task->id)
            ->assertOk()->assertJsonPath('forms.0.form_fields.3.options.1', 'Humide');
        $this->postJson($url.'/submit')->assertOk()->assertJsonPath('status', 'submitted');
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
