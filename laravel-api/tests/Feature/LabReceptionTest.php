<?php

namespace Tests\Feature;

use App\Models\ArticleAction;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Agency;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Sample;
use App\Models\Site;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LabReceptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendus_lists_confirmed_bc_lab_lines_with_technician(): void
    {
        [$labLine, $reportLine, $bc] = $this->seedBcWithLabAndReportLines();

        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);

        $res = $this->actingAs($lab, 'sanctum')->getJson('/api/v1/lab/reception/attendus');
        $res->assertOk();
        $res->assertJsonPath('stats.produits', 1);
        $res->assertJsonPath('data.0.id', $labLine->id);
        $res->assertJsonPath('data.0.quantite_attendue', 3);
        $res->assertJsonPath('data.0.bon_commande.numero', $bc->numero);
        $res->assertJsonPath('data.0.chantier.name', 'Chantier Réception');
        $res->assertJsonCount(1, 'data');

        $this->assertNotContains($reportLine->id, collect($res->json('data'))->pluck('id')->all());
    }

    public function test_attendus_excludes_brouillon_bc_and_lines_without_technician(): void
    {
        [$labLine] = $this->seedBcWithLabAndReportLines(statut: BonCommande::STATUT_BROUILLON);
        $labLine->update(['technicien_id' => null]);

        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $this->actingAs($lab, 'sanctum')->getJson('/api/v1/lab/reception/attendus')
            ->assertOk()
            ->assertJsonPath('stats.produits', 0);
    }

    public function test_attendus_tracks_sample_counts_per_bc_line(): void
    {
        [$labLine, , , $client] = $this->seedBcWithLabAndReportLines();
        $orderItemId = $this->legacyOrderItemId($client);

        Sample::query()->create([
            'order_item_id' => $orderItemId,
            'reference' => 'SMP-REC-TRANSIT',
            'bon_commande_ligne_id' => $labLine->id,
            'dossier_id' => $labLine->bonCommande->dossier_id,
            'product_id' => $labLine->ref_article_id,
            'sample_type' => 'sol',
            'status' => Sample::STATUS_EN_TRANSIT,
        ]);
        Sample::query()->create([
            'order_item_id' => $orderItemId,
            'reference' => 'SMP-REC-RECEIVED',
            'bon_commande_ligne_id' => $labLine->id,
            'dossier_id' => $labLine->bonCommande->dossier_id,
            'product_id' => $labLine->ref_article_id,
            'sample_type' => 'sol',
            'status' => Sample::STATUS_RECEPTIONNE,
            'received_at' => now(),
        ]);

        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $res = $this->actingAs($lab, 'sanctum')->getJson('/api/v1/lab/reception/attendus');
        $res->assertOk();
        $res->assertJsonPath('data.0.quantite_en_transit', 1);
        $res->assertJsonPath('data.0.quantite_recue', 1);
        $res->assertJsonPath('data.0.quantite_manquante', 1);
        $res->assertJsonPath('data.0.reception_complete', false);
    }

    private function legacyOrderItemId(Client $client): int
    {
        $agency = Agency::query()->create([
            'client_id' => $client->id,
            'name' => 'Siège réception',
            'is_headquarters' => true,
        ]);
        $testType = TestType::query()->create([
            'name' => 'Essai réception',
            'unit_price' => '10.00',
        ]);
        $order = Order::query()->create([
            'reference' => 'ORD-REC-'.uniqid(),
            'client_id' => $client->id,
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
     * @return array{0: BonCommandeLigne, 1: BonCommandeLigne, 2: BonCommande, 3: Client}
     */
    private function seedBcWithLabAndReportLines(string $statut = BonCommande::STATUT_CONFIRME): array
    {
        $client = Client::query()->create(['name' => 'Réception Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier Réception']);
        $technicien = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-REC-001',
            'titre' => 'Dossier réception',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $technicien->id,
        ]);

        $famille = FamilleArticle::query()->create([
            'code' => 'F-REC',
            'libelle' => 'Essais réception',
            'type_ressource' => 'labo',
            'actif' => true,
        ]);

        $labArticle = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ESSAI-SOL-REC',
            'libelle' => 'Essai sol réception',
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'actif' => true,
            'triggers_odm_labo' => true,
        ]);
        ArticleAction::query()->create([
            'ref_article_id' => $labArticle->id,
            'type' => ArticleAction::TYPE_LABO,
            'libelle' => 'Analyse sol',
            'ordre' => 1,
        ]);

        $reportArticle = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'RAPPORT-GEO',
            'libelle' => 'Rapport géotechnique',
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
            'actif' => true,
            'triggers_odm_ingenieur' => true,
            'triggers_odm_labo' => false,
        ]);
        ArticleAction::query()->create([
            'ref_article_id' => $reportArticle->id,
            'type' => ArticleAction::TYPE_INGENIEUR,
            'libelle' => 'Rédaction rapport',
            'ordre' => 1,
        ]);

        $bc = BonCommande::query()->create([
            'numero' => 'BC-REC-001',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => $statut,
            'date_commande' => '2026-03-01',
            'montant_ht' => 800,
            'montant_ttc' => 960,
            'tva_rate' => 20,
            'created_by' => $technicien->id,
        ]);

        $labLine = BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $labArticle->id,
            'libelle' => 'Essai sol réception',
            'quantite' => 3,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'montant_ht' => 300,
            'technicien_id' => $technicien->id,
        ]);

        $reportLine = BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $reportArticle->id,
            'libelle' => 'Rapport géotechnique',
            'quantite' => 1,
            'prix_unitaire_ht' => 500,
            'tva_rate' => 20,
            'montant_ht' => 500,
            'technicien_id' => $technicien->id,
        ]);

        return [$labLine, $reportLine, $bc, $client];
    }
}
