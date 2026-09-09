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
use App\Models\Site;
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

        $this->actingAs($lab, 'sanctum')
            ->getJson('/api/mission-tasks/terrain?active_only=1')
            ->assertOk()
            ->assertJsonCount(1);
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
            ->assertJsonCount(1);
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
        ]);
        ArticleAction::query()->create([
            'ref_article_id' => $article->id,
            'type' => ArticleAction::TYPE_TECHNICIEN,
            'libelle' => 'Prélèvement sync',
            'duree_heures' => 2,
            'ordre' => 1,
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-SYNC-001',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
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
