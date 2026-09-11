<?php

namespace Tests\Feature;

use App\Models\ArticleAction;
use App\Models\ArticleSectionProduct;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\JalonProduct;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\Site;
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
            'code' => 'PRD-ODM-A',
            'libelle' => 'Prélèvement A',
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
            'ref_article_id' => $jalon->id,
            'product_article_id' => $productA->id,
            'section_type' => ArticleSectionProduct::SECTION_TECHNICIEN,
            'ordre' => 1,
        ]);
        ArticleSectionProduct::query()->create([
            'ref_article_id' => $jalon->id,
            'product_article_id' => $productB->id,
            'section_type' => ArticleSectionProduct::SECTION_TECHNICIEN,
            'ordre' => 2,
        ]);
        $actionA = ArticleAction::query()->create([
            'ref_article_id' => $productA->id,
            'type' => ArticleAction::TYPE_TECHNICIEN,
            'libelle' => 'Prélèvement terrain A',
            'duree_heures' => 1,
            'ordre' => 1,
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
            'quantite' => 1,
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
            'montant_ht' => 500,
        ]);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
        $res->assertJsonPath('0.type', OrdreMission::TYPE_TECHNICIEN);
        $this->assertSame(2, OrdreMissionLigne::query()->count());
        $this->assertSame(2, MissionTask::query()->count());
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ref_article_id' => $productA->id,
            'article_action_id' => $actionA->id,
        ]);
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ref_article_id' => $productB->id,
            'article_action_id' => $actionB->id,
        ]);
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
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'montant_ht' => 100,
        ]);

        $res = $this->actingAs($lab, 'sanctum')
            ->postJson("/api/bons-commande/{$bc->id}/generate-ordres-mission");

        $res->assertCreated();
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
