<?php

namespace Tests\Feature;

use App\Models\ArticleAction;
use App\Models\ArticleSectionProduct;
use App\Models\Agency;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\JalonProduct;
use App\Models\LabReport;
use App\Models\LabReportSection;
use App\Models\MissionTask;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\PlanningHuman;
use App\Models\Sample;
use App\Models\Site;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrdreMissionFromBonCommandeTest extends TestCase
{
    use RefreshDatabase;

    public function test_generate_from_bc_en_cours_with_article_actions_creates_om_and_tasks(): void
    {
        [$bc, $lab] = $this->seedBcWithTechnicienAction();

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
        $res->assertJsonCount(1);
        $res->assertJsonPath('0.type', OrdreMission::TYPE_TECHNICIEN);
        $res->assertJsonPath('0.bon_commande_id', $bc->id);

        $omId = (int) $res->json('0.id');
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ordre_mission_id' => $omId,
            'bon_commande_ligne_id' => $bc->lignes()->first()->id,
        ]);
        $this->assertSame(1, MissionTask::query()->count());
    }

    public function test_generate_from_bc_uses_planning_fallback_without_catalogue_actions(): void
    {
        [$bc, $lab, $tech] = $this->seedBcWithTechnicienAction(withAction: false);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
        $res->assertJsonPath('0.type', OrdreMission::TYPE_TECHNICIEN);

        $ligne = OrdreMissionLigne::query()->first();
        $this->assertNotNull($ligne);
        $this->assertSame($tech->id, $ligne->assigned_user_id);
        $this->assertNull($ligne->article_action_id);
        $this->assertSame(1, MissionTask::query()->count());
    }

    public function test_terrain_planning_lists_assigned_om_tasks_and_separates_undated_tasks(): void
    {
        [$bc, $lab, $tech] = $this->seedBcWithTechnicienAction();
        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertCreated();

        $omLine = OrdreMissionLigne::query()->firstOrFail();
        $scheduledUrl = "/api/v1/planning-terrain?from=2026-03-09&to=2026-03-15&user_id={$tech->id}";
        $this->actingAs($lab, 'sanctum')->getJson($scheduledUrl)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.source', 'om')
            ->assertJsonPath('0.bon_commande_ligne.libelle', 'Prélèvement terrain');
        $this->actingAs($lab, 'sanctum')->getJson(
            "/api/v1/planning-terrain?from=2026-03-09&to=2026-03-15&user_id={$lab->id}"
        )->assertOk()->assertJsonCount(0);

        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/ordres-mission/{$omLine->ordre_mission_id}/lignes",
            ['lignes' => [['id' => $omLine->id, 'date_prevue' => null]]],
        )->assertOk();

        $this->actingAs($lab, 'sanctum')->getJson($scheduledUrl)->assertJsonCount(0);
        $this->actingAs($lab, 'sanctum')->getJson("{$scheduledUrl}&undated=1")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.source', 'om')
            ->assertJsonPath('0.user_id', $tech->id);
    }

    public function test_bulk_update_applies_jalon_values_and_syncs_planning_in_one_request(): void
    {
        [$bc, $lab, $tech] = $this->seedBcWithTechnicienAction();

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertCreated();

        $ordreMission = OrdreMission::query()->firstOrFail();
        $firstLine = $ordreMission->lignes()->firstOrFail();
        $secondLine = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $ordreMission->id,
            'bon_commande_ligne_id' => $firstLine->bon_commande_ligne_id,
            'ref_article_id' => $firstLine->ref_article_id,
            'article_action_id' => $firstLine->article_action_id,
            'libelle' => 'Deuxième tâche du jalon',
            'quantite' => 1,
            'statut' => 'a_faire',
            'ordre' => 2,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->putJson(
            "/api/ordres-mission/{$ordreMission->id}/lignes",
            [
                'lignes' => [
                    [
                        'id' => $firstLine->id,
                        'quantite' => 4,
                        'assigned_user_id' => $tech->id,
                        'date_prevue' => '2026-03-18',
                        'statut' => 'en_cours',
                    ],
                    [
                        'id' => $secondLine->id,
                        'quantite' => 4,
                        'assigned_user_id' => $tech->id,
                        'date_prevue' => '2026-03-18',
                        'statut' => 'en_cours',
                    ],
                ],
            ],
        );

        $response->assertOk()->assertJsonCount(2);
        $this->assertSame(2, OrdreMissionLigne::query()->where('quantite', 4)->count());
        $this->assertSame(2, PlanningHuman::query()->where('user_id', $tech->id)->whereDate('date_debut', '2026-03-18')->count());
        $this->assertDatabaseHas('ordres_mission', [
            'id' => $ordreMission->id,
            'statut' => OrdreMission::STATUT_EN_COURS,
        ]);
    }

    public function test_first_saved_assignment_plans_om_and_advances_bc_operational_status(): void
    {
        [$bc, $lab, $tech] = $this->seedBcWithTechnicienAction();
        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertCreated();

        $om = OrdreMission::query()->firstOrFail();
        $first = $om->lignes()->firstOrFail();
        $second = OrdreMissionLigne::query()->create([
            'ordre_mission_id' => $om->id,
            'bon_commande_ligne_id' => $first->bon_commande_ligne_id,
            'ref_article_id' => $first->ref_article_id,
            'article_action_id' => $first->article_action_id,
            'libelle' => 'Deuxième intervention',
            'quantite' => 1,
            'statut' => 'planifie',
            'ordre' => 2,
        ]);
        $second->ensureTaskExists();

        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/ordres-mission/{$om->id}/lignes/{$first->id}",
            ['assigned_user_id' => null, 'date_prevue' => null],
        )->assertOk();
        $this->assertSame(OrdreMission::STATUT_BROUILLON, $om->fresh()->statut);

        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/ordres-mission/{$om->id}/lignes/{$first->id}",
            ['assigned_user_id' => $tech->id, 'date_prevue' => '2026-09-25'],
        )->assertOk();
        $this->assertSame(OrdreMission::STATUT_PLANIFIE, $om->fresh()->statut);
        $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-commande/{$bc->id}")
            ->assertJsonPath('statut', $bc->statut)
            ->assertJsonPath('avancement_om.statut', 'planification_en_cours')
            ->assertJsonPath('avancement_om.planifiees', 1);

        $this->actingAs($lab, 'sanctum')->putJson(
            "/api/ordres-mission/{$om->id}/lignes",
            ['lignes' => [[
                'id' => $second->id,
                'assigned_user_id' => $tech->id,
                'date_prevue' => '2026-09-26',
            ]]],
        )->assertOk();
        $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-commande/{$bc->id}")
            ->assertJsonPath('avancement_om.statut', 'planifie')
            ->assertJsonPath('avancement_om.planifiees', 2);
    }

    public function test_generate_rejects_brouillon_bc(): void
    {
        [$bc, $lab] = $this->seedBcWithTechnicienAction(statut: BonCommande::STATUT_BROUILLON);

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertStatus(422);
    }

    public function test_generate_from_jalon_bc_creates_one_task_per_sub_product(): void
    {
        $client = Client::query()->create(['name' => 'ODM Client jalon']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier jalon']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-ODM-JAL',
            'titre' => 'Dossier jalon',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $famille = FamilleArticle::query()->create([
            'code' => 'GEO_JAL',
            'libelle' => 'Jalons',
            'ordre' => 1,
            'actif' => true,
        ]);
        $jalon = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'JAL-ODM-1',
            'libelle' => 'Forfait essais',
            'kind' => Article::KIND_JALON,
            'actif' => true,
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
        ]);
        $productA = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'D00063-ODM',
            'libelle' => 'Déplacement de technicien pour contrôle',
            'kind' => Article::KIND_PRODUCT,
            'actif' => true,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
        ]);
        $productB = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'PRD-ODM-B',
            'libelle' => 'Prélèvement B',
            'kind' => Article::KIND_PRODUCT,
            'actif' => true,
            'prix_unitaire_ht' => 120,
            'tva_rate' => 20,
        ]);
        JalonProduct::query()->create([
            'jalon_article_id' => $jalon->id,
            'product_article_id' => $productA->id,
            'ordre' => 1,
        ]);
        JalonProduct::query()->create([
            'jalon_article_id' => $jalon->id,
            'product_article_id' => $productB->id,
            'ordre' => 2,
        ]);
        ArticleSectionProduct::query()->create([
            'ref_article_id' => $productA->id,
            'product_article_id' => $productA->id,
            'section_type' => ArticleSectionProduct::SECTION_TECHNICIEN,
            'ordre' => 1,
        ]);
        ArticleSectionProduct::query()->create([
            'ref_article_id' => $productB->id,
            'product_article_id' => $productB->id,
            'section_type' => ArticleSectionProduct::SECTION_TECHNICIEN,
            'ordre' => 2,
        ]);
        $actionB = ArticleAction::query()->create([
            'ref_article_id' => $productB->id,
            'type' => ArticleAction::TYPE_TECHNICIEN,
            'libelle' => 'Prélèvement terrain B',
            'duree_heures' => 2,
            'ordre' => 1,
        ]);

        $bc = BonCommande::query()->create([
            'numero' => 'BCC-TEST-JAL',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_EN_COURS,
            'date_commande' => '2026-03-01',
            'montant_ht' => 500,
            'montant_ttc' => 600,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $jalon->id,
            'libelle' => $jalon->libelle,
            'quantite' => 6,
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
            'montant_ht' => 500,
        ]);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
        $res->assertJsonCount(1);
        $res->assertJsonPath('0.type', OrdreMission::TYPE_TECHNICIEN);
        $this->assertSame(2, OrdreMissionLigne::query()->count());
        $this->assertSame(2, MissionTask::query()->count());
        $this->assertSame(0, OrdreMissionLigne::query()->where('quantite', '!=', 1)->count());
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ref_article_id' => $productA->id,
            'article_action_id' => null,
        ]);
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ref_article_id' => $productB->id,
            'article_action_id' => $actionB->id,
        ]);
        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertOk();
        $this->assertSame(2, OrdreMissionLigne::query()->count());
    }

    public function test_generate_from_jalon_bc_routes_labo_product_to_labo_om_only(): void
    {
        $client = Client::query()->create(['name' => 'ODM Client labo section']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier labo']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-ODM-LAB',
            'titre' => 'Dossier labo section',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $famille = FamilleArticle::query()->create([
            'code' => 'GEO_LAB',
            'libelle' => 'Labo',
            'ordre' => 1,
            'actif' => true,
        ]);
        $jalon = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'JAL-LAB-1',
            'libelle' => 'Forfait eau',
            'kind' => Article::KIND_JALON,
            'actif' => true,
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
        ]);
        $productLab = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'PRD-LAB-EAU',
            'libelle' => "Prélèvement d'un échantillon d'eau (microbiologique)",
            'kind' => Article::KIND_PRODUCT,
            'actif' => true,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
        ]);
        JalonProduct::query()->create([
            'jalon_article_id' => $jalon->id,
            'product_article_id' => $productLab->id,
            'ordre' => 1,
        ]);
        ArticleSectionProduct::query()->create([
            'ref_article_id' => $jalon->id,
            'product_article_id' => $productLab->id,
            'section_type' => ArticleSectionProduct::SECTION_LABO,
            'ordre' => 1,
        ]);
        ArticleAction::query()->create([
            'ref_article_id' => $productLab->id,
            'type' => ArticleAction::TYPE_LABO,
            'libelle' => "Prélèvement d'un échantillon d'eau (microbiologique)",
            'duree_heures' => 2,
            'ordre' => 1,
        ]);
        // Action jalon terrain (ne doit pas remplacer le sous-produit labo).
        ArticleAction::query()->create([
            'ref_article_id' => $jalon->id,
            'type' => ArticleAction::TYPE_TECHNICIEN,
            'libelle' => 'Prélèvement terrain jalon',
            'duree_heures' => 1,
            'ordre' => 1,
        ]);

        $bc = BonCommande::query()->create([
            'numero' => 'BCC-TEST-LAB-SEC',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_EN_COURS,
            'date_commande' => '2026-03-01',
            'montant_ht' => 500,
            'montant_ttc' => 600,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $jalon->id,
            'libelle' => $jalon->libelle,
            'quantite' => 1,
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
            'montant_ht' => 500,
        ]);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
        $res->assertJsonCount(1);
        $res->assertJsonPath('0.type', OrdreMission::TYPE_LABO);
        $this->assertSame(0, OrdreMission::query()->where('type', OrdreMission::TYPE_TECHNICIEN)->count());
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ref_article_id' => $productLab->id,
        ]);
    }

    public function test_generate_from_product_bc_line_uses_jalon_labo_section(): void
    {
        $client = Client::query()->create(['name' => 'ODM Client product line']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier product']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-ODM-PRD',
            'titre' => 'Dossier product line',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $famille = FamilleArticle::query()->create([
            'code' => 'GEO_PRD',
            'libelle' => 'Produits',
            'ordre' => 1,
            'actif' => true,
        ]);
        $jalon = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'JAL-PRD',
            'libelle' => 'Forfait eau',
            'kind' => Article::KIND_JALON,
            'actif' => true,
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
        ]);
        $product = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'PRD-BC-LINE',
            'libelle' => 'Prélèvement eau BC ligne produit',
            'kind' => Article::KIND_PRODUCT,
            'actif' => true,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
        ]);
        JalonProduct::query()->create([
            'jalon_article_id' => $jalon->id,
            'product_article_id' => $product->id,
            'ordre' => 1,
        ]);
        ArticleSectionProduct::query()->create([
            'ref_article_id' => $jalon->id,
            'product_article_id' => $product->id,
            'section_type' => ArticleSectionProduct::SECTION_LABO,
            'ordre' => 1,
        ]);

        $bc = BonCommande::query()->create([
            'numero' => 'BCC-TEST-PRD',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_CONFIRME,
            'date_commande' => '2026-03-01',
            'montant_ht' => 100,
            'montant_ttc' => 120,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $product->id,
            'libelle' => $product->libelle,
            'quantite' => 1,
            'technicien_id' => $lab->id,
            'date_debut_prevue' => '2026-03-18',
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'montant_ht' => 100,
        ]);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
        $res->assertJsonCount(1);
        $res->assertJsonPath('0.type', OrdreMission::TYPE_LABO);
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ref_article_id' => $product->id,
        ]);
    }

    public function test_generate_from_bc_creates_technicien_om_for_libelle_only_line(): void
    {
        $client = Client::query()->create(['name' => 'ODM Client libelle']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier libelle']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-ODM-LIB',
            'titre' => 'Dossier libelle',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-TEST-LIB',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_EN_COURS,
            'date_commande' => '2026-03-01',
            'montant_ht' => 50,
            'montant_ttc' => 60,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => null,
            'libelle' => 'Prestation terrain sans article',
            'quantite' => 1,
            'prix_unitaire_ht' => 50,
            'tva_rate' => 20,
            'montant_ht' => 50,
        ]);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
        $res->assertJsonPath('0.type', OrdreMission::TYPE_TECHNICIEN);
        $this->assertSame(1, OrdreMissionLigne::query()->count());
        $this->assertSame(1, MissionTask::query()->count());
    }

    public function test_product_sections_create_engineer_and_technician_tasks_only_for_remaining_bc_quantity(): void
    {
        [$bc, $lab] = $this->seedBcWithTechnicienAction(withAction: false);
        $line = $bc->lignes()->firstOrFail();
        $line->update(['date_debut_prevue' => now()->addDay()->toDateString()]);
        $article = Article::query()->findOrFail($line->ref_article_id);
        $article->update(['kind' => Article::KIND_PRODUCT]);
        foreach ([ArticleSectionProduct::SECTION_TECHNICIEN, ArticleSectionProduct::SECTION_INGENIEUR] as $type) {
            ArticleSectionProduct::query()->create([
                'ref_article_id' => $article->id,
                'product_article_id' => $article->id,
                'section_type' => $type,
                'ordre' => 1,
                'quantite' => 1,
            ]);
        }

        $first = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");
        $first->assertCreated()->assertJsonCount(2);
        $this->assertEqualsCanonicalizing(
            [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR],
            OrdreMission::query()->pluck('type')->all(),
        );
        $firstIds = OrdreMission::query()->pluck('id')->all();

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertOk()->assertJsonCount(2);
        $this->assertSame(2, OrdreMission::query()->count());
        $this->assertSame(2, MissionTask::query()->count());

        $line->update(['quantite' => 3]);
        $this->actingAs($lab, 'sanctum')
            ->getJson("/api/v1/bons-commande/{$bc->id}")
            ->assertJsonPath('avancement_om.statut', 'planification_en_cours');
        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertCreated()->assertJsonCount(4);
        $this->assertSame(4, OrdreMission::query()->count());
        $this->assertSame(6, OrdreMissionLigne::query()->count());
        $this->assertSame(0, OrdreMissionLigne::query()->where('quantite', '!=', 1)->count());
        foreach ($firstIds as $id) {
            $this->assertDatabaseHas('ordres_mission', ['id' => $id, 'deleted_at' => null]);
        }
        foreach ([OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR] as $type) {
            $this->assertSame(3.0, (float) OrdreMissionLigne::query()
                ->whereHas('ordreMission', fn ($query) => $query->where('type', $type))
                ->sum('quantite'));
        }

        $this->actingAs($lab, 'sanctum')
            ->getJson("/api/v1/bons-commande/{$bc->id}")
            ->assertOk()
            ->assertJsonPath('lignes.0.om_quantites.technicien', 3)
            ->assertJsonPath('lignes.0.om_quantites.ingenieur', 3);
    }

    public function test_reception_closes_technician_task_only_after_its_label_is_received(): void
    {
        [$bc, $lab] = $this->seedBcWithTechnicienAction();
        $bc->lignes()->firstOrFail()->update(['quantite' => 2]);
        $this->seedLegacyOrderItem($bc);
        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertCreated();
        $task = MissionTask::query()->firstOrFail();

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/mission-tasks/{$task->id}/close-reception", [
                'pv_numbers' => ['PV-001'],
                'quantity_unit' => 'point',
                'quantity_count' => 2,
            ])->assertOk();

        $this->assertDatabaseHas('mission_tasks', ['id' => $task->id, 'statut' => MissionTask::STATUT_DONE]);
        $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-commande/{$bc->id}")
            ->assertJsonPath('avancement_om.statut', 'attente_validation')
            ->assertJsonPath('avancement_om.cloturees', 0);

        $samples = Sample::query()->where('task_id', $task->id)->orderBy('id')->get();
        $this->assertCount(2, $samples);
        $this->actingAs($lab, 'sanctum')
            ->patchJson("/api/v1/samples/{$samples[0]->id}/receive", ['condition_state' => 'bon'])
            ->assertOk();
        $this->assertSame(MissionTask::STATUT_DONE, $task->fresh()->statut);
        $this->actingAs($lab, 'sanctum')
            ->patchJson("/api/v1/samples/{$samples[1]->id}/receive", ['condition_state' => 'bon'])
            ->assertOk();

        $this->assertDatabaseHas('mission_tasks', ['id' => $task->id, 'statut' => MissionTask::STATUT_VALIDATED]);
        $this->assertDatabaseHas('ordre_mission_lignes', ['id' => $task->ordre_mission_ligne_id, 'statut' => 'cloture']);
        $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-commande/{$bc->id}")
            ->assertJsonPath('avancement_om.statut', 'a_replanifier')
            ->assertJsonPath('avancement_om.cloturees', 1);
    }

    public function test_validated_report_closes_only_its_linked_task(): void
    {
        [$bc, $lab] = $this->seedBcWithTechnicienAction();
        $orderItemId = $this->seedLegacyOrderItem($bc);
        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission")
            ->assertCreated();
        $task = MissionTask::query()->firstOrFail();
        $sample = Sample::query()->create([
            'order_item_id' => $orderItemId,
            'reference' => 'ECH-RAPPORT-001',
            'task_id' => $task->id,
            'bon_commande_ligne_id' => $bc->lignes()->firstOrFail()->id,
            'status' => Sample::STATUS_RECEPTIONNE,
        ]);
        $report = LabReport::query()->create([
            'number' => 'RPT-ODM-001',
            'bc_id' => $bc->id,
            'title' => 'Rapport lié à la tâche',
            'status' => 'brouillon',
        ]);
        LabReportSection::query()->create([
            'report_id' => $report->id,
            'sample_id' => $sample->id,
            'ordre' => 1,
        ]);

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/lab-reports/{$report->id}/transition", ['status' => 'en_validation'])
            ->assertOk();
        $this->assertSame(MissionTask::STATUT_TODO, $task->fresh()->statut);
        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/lab-reports/{$report->id}/transition", ['status' => 'valide'])
            ->assertOk();

        $this->assertDatabaseHas('mission_tasks', ['id' => $task->id, 'statut' => MissionTask::STATUT_VALIDATED]);
        $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-commande/{$bc->id}")
            ->assertJsonPath('avancement_om.statut', 'cloture');
    }

    private function seedLegacyOrderItem(BonCommande $bc): int
    {
        $agency = Agency::query()->create([
            'client_id' => $bc->client_id,
            'name' => 'Agence test OM',
            'is_headquarters' => true,
        ]);
        $testType = TestType::query()->create(['name' => 'Essai OM', 'unit_price' => 10]);
        $order = Order::query()->create([
            'reference' => 'ORD-ODM-'.$bc->id,
            'client_id' => $bc->client_id,
            'agency_id' => $agency->id,
            'status' => Order::STATUS_IN_PROGRESS,
            'order_date' => now()->toDateString(),
        ]);

        return (int) OrderItem::query()->create([
            'order_id' => $order->id,
            'test_type_id' => $testType->id,
            'quantity' => 1,
        ])->id;
    }

    /**
     * @return array{0: BonCommande, 1: User, 2?: User}
     */
    private function seedBcWithTechnicienAction(
        string $statut = BonCommande::STATUT_EN_COURS,
        bool $withAction = true,
    ): array {
        $client = Client::query()->create(['name' => 'ODM Client']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier ODM']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $tech = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-ODM-001',
            'titre' => 'Dossier ODM',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $famille = FamilleArticle::query()->create([
            'code' => 'GEO_TEST',
            'libelle' => 'Test',
            'ordre' => 1,
            'actif' => true,
        ]);
        $article = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ART-ODM-1',
            'libelle' => 'Essai terrain',
            'kind' => Article::KIND_JALON,
            'actif' => true,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
        ]);
        if ($withAction) {
            ArticleAction::query()->create([
                'ref_article_id' => $article->id,
                'type' => ArticleAction::TYPE_TECHNICIEN,
                'libelle' => 'Prélèvement terrain',
                'duree_heures' => 2,
                'ordre' => 1,
            ]);
        }

        $bc = BonCommande::query()->create([
            'numero' => 'BCC-TEST-001',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => $statut,
            'date_commande' => '2026-03-01',
            'montant_ht' => 100,
            'montant_ttc' => 120,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $article->id,
            'libelle' => $article->libelle,
            'quantite' => 1,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'montant_ht' => 100,
            'technicien_id' => $tech->id,
            'date_debut_prevue' => '2026-03-10',
            'date_fin_prevue' => '2026-03-12',
        ]);

        return [$bc->fresh('lignes'), $lab, $tech];
    }
}
