<?php

namespace Tests\Feature;

use App\Models\BonCommande;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\OrdreMission;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrdreMissionJalonTasksTest extends TestCase
{
    use RefreshDatabase;

    public function test_batch_adds_one_task_per_product_under_the_jalon(): void
    {
        [$om, $lab, $articles] = $this->seedLaboOmWithJalon();

        $res = $this->actingAs($lab, 'sanctum')->postJson("/api/ordres-mission/{$om->id}/lignes/batch", [
            'devis_jalon_id' => 'j-beton',
            'items' => [
                ['ref_article_id' => $articles[0]->id, 'quantite' => 3],
                ['ref_article_id' => $articles[1]->id, 'quantite' => 1.5],
            ],
        ]);

        $res->assertCreated()->assertJsonCount(2);
        $this->assertDatabaseHas('ordre_mission_lignes', [
            'ordre_mission_id' => $om->id,
            'ref_article_id' => $articles[0]->id,
            'devis_jalon_id' => 'j-beton',
            'libelle' => 'Écrasement éprouvette',
        ]);
        $this->assertSame(2, $om->lignes()->whereHas('missionTasks')->count());

        $board = $this->actingAs($lab, 'sanctum')->getJson('/api/mission-tasks/labo')->assertOk();
        $this->assertSame('Contrôle de béton', $board->json('0.jalon_context.label'));
    }

    public function test_batch_rejects_unknown_jalon(): void
    {
        [$om, $lab, $articles] = $this->seedLaboOmWithJalon();

        $this->actingAs($lab, 'sanctum')->postJson("/api/ordres-mission/{$om->id}/lignes/batch", [
            'devis_jalon_id' => 'inexistant',
            'items' => [['ref_article_id' => $articles[0]->id, 'quantite' => 1]],
        ])->assertStatus(422);
        $this->assertSame(0, $om->lignes()->count());
    }

    /** @return array{0: OrdreMission, 1: User, 2: list<Article>} */
    private function seedLaboOmWithJalon(): array
    {
        $client = Client::query()->create(['name' => 'Client jalon OM']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier jalon OM']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-JAL-OM', 'titre' => 'Dossier', 'client_id' => $client->id, 'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS, 'date_debut' => '2026-09-01', 'created_by' => $lab->id,
        ]);
        $famille = FamilleArticle::query()->create(['code' => 'JAL_OM', 'libelle' => 'Test', 'ordre' => 1, 'actif' => true]);
        $articles = [
            Article::query()->create([
                'ref_famille_article_id' => $famille->id, 'code' => 'ECR-1', 'libelle' => 'Écrasement éprouvette',
                'kind' => Article::KIND_PRODUCT, 'actif' => true, 'prix_unitaire_ht' => 50, 'tva_rate' => 20,
            ]),
            Article::query()->create([
                'ref_famille_article_id' => $famille->id, 'code' => 'SLU-1', 'libelle' => 'Slump test',
                'kind' => Article::KIND_PRODUCT, 'actif' => true, 'prix_unitaire_ht' => 30, 'tva_rate' => 20,
            ]),
        ];
        $quote = Quote::query()->create([
            'number' => 'DEV-JAL-OM', 'client_id' => $client->id, 'dossier_id' => $dossier->id,
            'quote_date' => '2026-09-01', 'amount_ht' => 100, 'amount_ttc' => 120, 'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
            'meta' => ['devis_jalons' => [[
                'id' => 'j-beton', 'libelle' => 'Contrôle de béton', 'mode' => 'detaille', 'product_ref_article_ids' => [],
            ]]],
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-JAL-OM', 'quote_id' => $quote->id, 'dossier_id' => $dossier->id,
            'client_id' => $client->id, 'statut' => BonCommande::STATUT_EN_COURS,
            'date_commande' => '2026-09-01', 'montant_ht' => 100, 'montant_ttc' => 120, 'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        $om = OrdreMission::query()->create([
            'numero' => 'OM-L-JAL-001', 'bon_commande_id' => $bc->id, 'dossier_id' => $dossier->id,
            'client_id' => $client->id, 'type' => OrdreMission::TYPE_LABO, 'statut' => OrdreMission::STATUT_BROUILLON,
            'created_by' => $lab->id,
        ]);

        return [$om, $lab, $articles];
    }
}
